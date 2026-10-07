"""'Como foi?': a validação da resposta (sem banco, roda em qualquer lugar)."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import feedback  # noqa: E402


class NormalizeTests(unittest.TestCase):
    def test_rating_and_comment(self):
        self.assertEqual(
            feedback.normalize({"context": "cardapio_falado", "rating": 3, "comment": "  muito bom\t demais "}),
            ("cardapio_falado", 3, "muito bom demais"),
        )

    def test_rating_must_be_one_of_the_three_faces(self):
        for rating in (0, 4, "3", 2.5, True, None):
            with self.assertRaises(feedback.FeedbackError):
                feedback.normalize({"rating": rating})
        with self.assertRaises(feedback.FeedbackError):
            feedback.normalize(None)

    def test_unknown_context_becomes_general(self):
        self.assertEqual(feedback.normalize({"rating": 1, "context": "<script>"})[0], "geral")
        self.assertEqual(feedback.normalize({"rating": 1})[0], "geral")

    def test_comment_is_cleaned_and_cut(self):
        _, _, comment = feedback.normalize({"rating": 2, "comment": "a\x00b\n\n\n\nc" + "x" * 600})
        self.assertNotIn("\x00", comment)
        self.assertNotIn("\n\n\n", comment)
        self.assertLessEqual(len(comment), feedback.MAX_COMMENT)
        self.assertEqual(feedback.normalize({"rating": 2, "comment": None})[2], "")
        with self.assertRaises(feedback.FeedbackError):
            feedback.normalize({"rating": 2, "comment": 12})


class LimiterTests(unittest.TestCase):
    def test_per_person_per_hour(self):
        now = [1000.0]
        limiter = feedback.Limiter(clock=lambda: now[0])
        for _ in range(feedback.PER_USER_PER_HOUR):
            limiter.check("c1:u1")
        with self.assertRaises(feedback.FeedbackError):
            limiter.check("c1:u1")
        limiter.check("c1:u2")
        now[0] += 3601
        limiter.check("c1:u1")


if __name__ == "__main__":
    unittest.main()
