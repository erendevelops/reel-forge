/**
 * Colour tags of every encode we write: TV range, BT.709 primaries/transfer/matrix. This ffmpeg build's libx264
 * drops -color_primaries/-color_trc from the VUI, so the x264 params carry them too (ignored by other encoders).
 */
export const TV_BT709_TAGS = [
  '-color_range', 'tv', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
  '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709',
];

/** Working-clip encode (global constraints): x264 slow, CRF 4 (never 0: High 4:4:4 doesn't decode in Chrome), GOP 30. */
export const WORKING_CLIP_X264 = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '4', '-g', '30', ...TV_BT709_TAGS];
