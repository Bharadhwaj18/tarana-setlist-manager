/** Anything on a page can ask the quick-add form to open by dispatching this on window. */
export const QUICK_ADD_EVENT = 'tarana:quick-add'
export const openQuickAdd = () => window.dispatchEvent(new Event(QUICK_ADD_EVENT))
