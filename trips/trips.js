/* The list of trips in this repo. Add one line per trip folder.
   - id      must be exactly the folder name under trips/ (letters, numbers, dashes, underscores)
   - name    is what people see in the trip chooser and the "Other trips" links
   - dates   is optional, shown in the chooser
   "default" is the trip shown when the page is opened without ?trip=... */
window.TRIPS = {
  default: "japan-2026",
  list: [
    { id: "japan-2026", name: "Japan 2026", dates: "Oct 8–27, 2026" }
  ]
};
