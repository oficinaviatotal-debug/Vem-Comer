from __future__ import annotations

import hashlib
import hmac
import json
import threading
import time
from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol


class PaymentAdapter(Protocol):
    def create_payment(self, order_id: str, amount: Decimal) -> dict: ...
    def get_payment(self, provider_payment_id: str) -> dict: ...


@dataclass(frozen=True)
class PaymentEvent:
    provider: str
    event_id: str
    raw_body: bytes
    signature: str
    timestamp: int


class MockPSP:
    """Deterministic PSP used only by tests/CI; no network or production credentials."""

    provider = "mock"

    def __init__(self, secret: bytes):
        self.secret = secret
        self.payments: dict[str, dict] = {}
        self._counter = 0

    def create_payment(self, order_id: str, amount: Decimal) -> dict:
        self._counter += 1
        payment_id = f"mock-{self._counter}"
        self.payments[payment_id] = {
            "id": payment_id,
            "order_id": order_id,
            "amount": Decimal(str(amount)),
            "status": "PENDING",
        }
        return {"id": payment_id, "status": "PENDING"}

    def mark_paid(self, payment_id: str, amount: Decimal | None = None) -> None:
        p = self.payments[payment_id]
        p["amount"] = Decimal(str(amount if amount is not None else p["amount"]))
        p["status"] = "PAID"

    def expire(self, payment_id: str) -> None:
        self.payments[payment_id]["status"] = "EXPIRED"

    def get_payment(self, provider_payment_id: str) -> dict:
        return dict(self.payments[provider_payment_id])

    def sign(self, raw_body: bytes, timestamp: int) -> str:
        message = f"{timestamp}.".encode() + raw_body
        return hmac.new(self.secret, message, hashlib.sha256).hexdigest()


class OrderPaymentState:
    TERMINAL = {"PAID", "CANCELLED", "EXPIRED"}

    def __init__(self, order_id: str, amount: Decimal):
        self.order_id = order_id
        self.amount = Decimal(str(amount))
        self.status = "PENDING_PAYMENT"
        self._lock = threading.Lock()
        self._events: set[tuple[str, str]] = set()

    def create_payment(self, adapter: PaymentAdapter) -> dict:
        return adapter.create_payment(self.order_id, self.amount)

    def handle_webhook(
        self,
        *,
        adapter: PaymentAdapter,
        event: PaymentEvent,
        max_age_seconds: int = 300,
        now: int | None = None,
    ) -> str:
        now = int(time.time()) if now is None else int(now)
        if abs(now - event.timestamp) > max_age_seconds:
            raise ValueError("stale webhook")

        expected = adapter.sign(event.raw_body, event.timestamp)  # type: ignore[attr-defined]
        if not hmac.compare_digest(expected, event.signature):
            raise ValueError("invalid signature")

        with self._lock:
            key = (event.provider, event.event_id)
            if key in self._events:
                return self.status

            payload = json.loads(event.raw_body.decode("utf-8"))
            payment_id = payload["payment_id"]
            remote = adapter.get_payment(payment_id)

            if remote["order_id"] != self.order_id:
                raise ValueError("payment/order mismatch")
            if Decimal(str(remote["amount"])) != self.amount:
                raise ValueError("amount mismatch")

            self._events.add(key)

            if self.status == "CANCELLED":
                return self.status
            if remote["status"] == "PAID":
                self.status = "PAID"
            elif remote["status"] == "EXPIRED":
                self.status = "EXPIRED"

            return self.status
