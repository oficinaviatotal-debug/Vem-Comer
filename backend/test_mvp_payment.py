import json
import threading
import unittest
from decimal import Decimal

from mvp_payment import MockPSP, OrderPaymentState, PaymentEvent


class MvpPaymentTests(unittest.TestCase):
    def setUp(self):
        self.psp = MockPSP(b"ci-only-secret")
        self.order = OrderPaymentState("order-a", Decimal("42.50"))
        self.payment = self.order.create_payment(self.psp)

    def event(self, event_id="evt-1", timestamp=1_700_000_000):
        body = json.dumps({"payment_id": self.payment["id"]}, separators=(",", ":")).encode()
        return PaymentEvent(
            provider="mock",
            event_id=event_id,
            raw_body=body,
            signature=self.psp.sign(body, timestamp),
            timestamp=timestamp,
        )

    def test_valid_webhook_confirms_only_after_remote_psp_status(self):
        self.psp.mark_paid(self.payment["id"])
        self.assertEqual(self.order.handle_webhook(adapter=self.psp, event=self.event(), now=1_700_000_001), "PAID")

    def test_signature_is_over_raw_body(self):
        self.psp.mark_paid(self.payment["id"])
        original = self.event()
        tampered = PaymentEvent(
            provider=original.provider,
            event_id=original.event_id,
            raw_body=b'{"payment_id":"tampered"}',
            signature=original.signature,
            timestamp=original.timestamp,
        )
        with self.assertRaises(ValueError):
            self.order.handle_webhook(adapter=self.psp, event=tampered, now=1_700_000_001)

    def test_stale_and_amount_mismatch_are_rejected(self):
        self.psp.mark_paid(self.payment["id"])
        with self.assertRaises(ValueError):
            self.order.handle_webhook(adapter=self.psp, event=self.event(), now=1_700_001_000)

        bad = MockPSP(b"ci-only-secret")
        payment = bad.create_payment("order-a", Decimal("40.00"))
        bad.mark_paid(payment["id"])
        body = json.dumps({"payment_id": payment["id"]}, separators=(",", ":")).encode()
        event = PaymentEvent("mock", "evt-bad-amount", body, bad.sign(body, 1_700_000_000), 1_700_000_000)
        with self.assertRaises(ValueError):
            self.order.handle_webhook(adapter=bad, event=event, now=1_700_000_001)

    def test_repeated_webhook_is_idempotent(self):
        self.psp.mark_paid(self.payment["id"])
        event = self.event()
        self.assertEqual(self.order.handle_webhook(adapter=self.psp, event=event, now=1_700_000_001), "PAID")
        self.assertEqual(self.order.handle_webhook(adapter=self.psp, event=event, now=1_700_000_002), "PAID")

    def test_50_concurrent_confirmations_produce_one_effect(self):
        self.psp.mark_paid(self.payment["id"])
        event = self.event("evt-concurrent")
        results = []
        errors = []

        def worker():
            try:
                results.append(self.order.handle_webhook(adapter=self.psp, event=event, now=1_700_000_001))
            except Exception as exc:
                errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(50)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(len(errors), 0)
        self.assertEqual(len(results), 50)
        self.assertEqual(self.order.status, "PAID")


if __name__ == "__main__":
    unittest.main()
