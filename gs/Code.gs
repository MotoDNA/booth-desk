/**
 * Entry points. Apps Script requires these to be global.
 */
function doPost(e) { return ApiRouter.handle(e); }
function doGet(e)  { return ApiRouter.handleGet(e); }

/** Run once from the editor to create the sheets. */
function setup() {
  SheetService.ensureAll();
  return 'ok';
}
