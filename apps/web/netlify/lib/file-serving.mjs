// How a file leaves storage. Decided here, on the server, from the name the database holds for
// the file: never from the type its uploader claimed, and never from a type the browser asks for.
//
//   'save'     plain bytes, saved to disk under the file's own name. Every file, by default: a
//              web page or an SVG someone uploaded never opens as a page, with its scripts running.
//   'pdf'      the one exception: a file whose name ends in .pdf, sent as a PDF and nothing else,
//              to be shown in the browser's PDF reader inside the app's viewer. The reader's own
//              download button then saves it under its name, not under a made-up one.
//   'refused'  a frame was asked for something that is not a PDF.

/**
 * @param {string | null | undefined} name the file's name, as the database has it
 * @param {string | null | undefined} purpose what the browser asked for: 'frame', or anything else
 * @returns {'save' | 'pdf' | 'refused'}
 */
export function serving(name, purpose) {
  if (purpose !== 'frame') return 'save'
  return typeof name === 'string' && /\.pdf$/i.test(name.trim()) ? 'pdf' : 'refused'
}
