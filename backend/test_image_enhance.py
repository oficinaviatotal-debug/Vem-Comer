import io
import random
import unittest

from PIL import Image, ImageDraw

import image_enhance as ie


def scene(width=1600, height=1200, brightness=1.0, seed=1):
    """Uma 'foto' sintética: fundo de mesa com bolinhas coloridas (o suficiente para ter detalhe)."""
    im = Image.new("RGB", (width, height), (200, 170, 120))
    draw = ImageDraw.Draw(im)
    rnd = random.Random(seed)
    for _ in range(300):
        x, y, r = rnd.randint(0, width), rnd.randint(0, height), rnd.randint(10, 60)
        draw.ellipse(
            (x - r, y - r, x + r, y + r),
            fill=(rnd.randint(80, 255), rnd.randint(50, 200), rnd.randint(20, 150)),
        )
    # um canto bem preto e um bem branco: a foto já usa toda a faixa de luz (como uma foto boa)
    draw.rectangle((0, 0, 30, 30), fill=(0, 0, 0))
    draw.rectangle((40, 0, 70, 30), fill=(255, 255, 255))
    if brightness != 1.0:
        im = im.point(lambda v: int(v * brightness))
    return im


def encode(im, fmt="JPEG", **kwargs):
    out = io.BytesIO()
    im.save(out, fmt, **kwargs)
    return out.getvalue()


def decode(data):
    return Image.open(io.BytesIO(data))


class ValidationTests(unittest.TestCase):
    def test_refuses_empty_and_non_images(self):
        for data in (b"", b"hello", b"<svg xmlns='http://www.w3.org/2000/svg'></svg>", b"%PDF-1.7 ...", b"GIF89a....."):
            with self.assertRaises(ie.PhotoError):
                ie.enhance_photo(data)

    def test_refuses_a_file_that_only_pretends_to_be_a_jpeg(self):
        with self.assertRaises(ie.PhotoError):
            ie.enhance_photo(b"\xff\xd8\xff" + b"not really an image" * 50)

    def test_refuses_a_truncated_photo(self):
        good = encode(scene(), "JPEG")
        with self.assertRaises(ie.PhotoError):
            ie.enhance_photo(good[: len(good) // 3])

    def test_refuses_tiny_photos(self):
        with self.assertRaises(ie.PhotoError) as ctx:
            ie.enhance_photo(encode(Image.new("RGB", (120, 90), "red")))
        self.assertIn("pequena", str(ctx.exception))

    def test_refuses_huge_png_without_reading_every_pixel(self):
        # 30 megapixels of one color: tiny file, big memory if opened carelessly
        data = encode(Image.new("RGB", (6000, 5000), "white"), "PNG", optimize=False)
        with self.assertRaises(ie.PhotoError) as ctx:
            ie.enhance_photo(data)
        self.assertIn("grande", str(ctx.exception))

    def test_error_messages_are_ready_for_the_owner(self):
        # Portuguese, no jargon, no exception names
        for data in (b"", b"hello"):
            with self.assertRaises(ie.PhotoError) as ctx:
                ie.enhance_photo(data)
            message = str(ctx.exception)
            self.assertTrue(message.endswith((".", "!")))
            for jargon in ("Traceback", "Exception", "PIL", "bytes"):
                self.assertNotIn(jargon, message)


class OutputTests(unittest.TestCase):
    def test_output_is_two_webp_files_in_4x3(self):
        result = ie.enhance_photo(encode(scene(1600, 1200)))
        full, thumb = decode(result.full), decode(result.thumb)
        self.assertEqual(full.format, "WEBP")
        self.assertEqual(thumb.format, "WEBP")
        self.assertEqual(full.size, ie.FULL_SIZE)
        self.assertEqual(thumb.size, ie.THUMB_SIZE)
        self.assertEqual((result.width, result.height), ie.FULL_SIZE)

    def test_wide_and_tall_photos_are_cropped_to_4x3(self):
        for size in ((2400, 1000), (900, 2000), (1500, 1500)):
            result = ie.enhance_photo(encode(scene(*size)))
            width, height = decode(result.full).size
            self.assertAlmostEqual(width / height, 4 / 3, delta=0.01, msg=str(size))
            self.assertLessEqual(width, ie.FULL_SIZE[0])

    def test_small_photo_is_not_stretched(self):
        result = ie.enhance_photo(encode(scene(640, 480)))
        self.assertEqual(decode(result.full).size, (640, 480))
        self.assertEqual(decode(result.thumb).size, (480, 360))

    def test_phone_held_sideways_is_turned_upright(self):
        # EXIF orientation 6 = the phone was rotated; the pixels are stored sideways
        raw = scene(1200, 900)
        exif = Image.Exif()
        exif[0x0112] = 6
        result = ie.enhance_photo(encode(raw, "JPEG", exif=exif.tobytes()))
        # after turning upright the photo is 900 wide x 1200 tall, then cropped to 4:3 => 900 x 675
        self.assertEqual(decode(result.full).size, (900, 675))

    def test_hidden_data_is_removed(self):
        exif = Image.Exif()
        exif[0x010F] = "SecretPhoneMaker"
        exif[0x0132] = "2026:10:06 12:00:00"
        result = ie.enhance_photo(encode(scene(), "JPEG", exif=exif.tobytes()))
        for blob in (result.full, result.thumb):
            self.assertNotIn(b"SecretPhoneMaker", blob)
            self.assertNotIn(b"EXIF", blob)
            self.assertEqual(len(decode(blob).getexif()), 0)

    def test_transparent_png_gets_a_white_background(self):
        im = Image.new("RGBA", (800, 600), (0, 0, 0, 0))
        ImageDraw.Draw(im).ellipse((200, 150, 600, 450), fill=(200, 30, 30, 255))
        result = ie.enhance_photo(encode(im, "PNG"))
        corner = decode(result.full).convert("RGB").getpixel((5, 5))
        self.assertTrue(all(channel > 230 for channel in corner), corner)

    def test_files_are_light_enough_for_a_phone_on_mobile_data(self):
        result = ie.enhance_photo(encode(scene(3000, 2250)))
        self.assertLess(len(result.full), 400_000)
        self.assertLess(len(result.thumb), 120_000)

    def test_accepts_png_and_webp_input(self):
        for fmt in ("PNG", "WEBP"):
            result = ie.enhance_photo(encode(scene(1000, 750), fmt))
            self.assertEqual(decode(result.full).format, "WEBP", fmt)

    def test_animated_input_uses_the_first_frame(self):
        frames = [scene(600, 450, seed=1), scene(600, 450, seed=2)]
        out = io.BytesIO()
        frames[0].save(out, "WEBP", save_all=True, append_images=frames[1:], duration=100, loop=0)
        result = ie.enhance_photo(out.getvalue())
        self.assertEqual(decode(result.full).format, "WEBP")


class ImprovementTests(unittest.TestCase):
    def luma(self, data):
        return ie._luma(decode(data).convert("RGB"))

    def test_dark_photo_gets_brighter_and_a_tip(self):
        dark = scene(brightness=0.3)
        before = ie._luma(dark)
        result = ie.enhance_photo(encode(dark))
        self.assertGreater(self.luma(result.full), before * 1.4)
        self.assertIn("Mais luz", result.improvements)
        self.assertTrue(any("escura" in tip for tip in result.tips), result.tips)

    def test_overexposed_photo_gets_a_tip(self):
        bright = Image.new("RGB", (800, 600), (250, 250, 245))
        ImageDraw.Draw(bright).ellipse((250, 150, 550, 450), fill=(255, 235, 200))
        result = ie.enhance_photo(encode(bright))
        self.assertTrue(any("clara" in tip for tip in result.tips), result.tips)

    def test_normal_photo_gets_no_complaints_and_is_not_darkened(self):
        original = scene()
        result = ie.enhance_photo(encode(original))
        self.assertEqual(result.tips, [])
        self.assertIn("Cores mais vivas", result.improvements)
        self.assertNotIn("Menos luz", result.improvements)

    def test_a_white_plate_stays_white(self):
        plate = Image.new("RGB", (800, 600), (250, 250, 250))
        ImageDraw.Draw(plate).ellipse((250, 150, 550, 450), fill=(200, 80, 40))
        result = ie.enhance_photo(encode(plate))
        corner = decode(result.full).convert("RGB").getpixel((5, 5))
        self.assertTrue(all(channel >= 240 for channel in corner), corner)

    def test_colors_get_a_little_more_vivid_not_cartoonish(self):
        from PIL import ImageStat

        def saturation(im):
            return ImageStat.Stat(im.convert("RGB").convert("HSV").getchannel("S")).mean[0]

        original = scene()
        result = ie.enhance_photo(encode(original))
        ratio = saturation(decode(result.full)) / saturation(original.resize(ie.FULL_SIZE))
        self.assertGreater(ratio, 1.02)
        self.assertLess(ratio, 1.45)

    def test_same_photo_gives_the_same_result(self):
        data = encode(scene())
        self.assertEqual(ie.enhance_photo(data).full, ie.enhance_photo(data).full)


if __name__ == "__main__":
    unittest.main()
