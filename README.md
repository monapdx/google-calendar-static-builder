# 📅 Google Calendar Static Builder

Turn a Google Calendar `.ics` export into a beautiful, browseable,
static calendar site.

No server.\
No uploads.\
No tracking.\
No backend.

Everything runs locally in your browser.

------------------------------------------------------------------------

## 🚀 Live Tool

👉 Use it here:\
[https://monapdx.github.io/google-calendar-static-builder/](https://monapdx.github.io/google-calendar-static-builder/)

------------------------------------------------------------------------

## 🧠 What It Does

Upload a `.ics` file (like one exported from Google Calendar) and the
tool generates:

    calendar_site/
    ├── index.html
    ├── assets/
    │   ├── app.js
    │   └── style.css
    └── data/
        ├── meta.js
        └── events_by_date.js

You can:

-   Browse by year
-   Browse by month
-   Click into individual days
-   Search across events
-   Navigate similar to Google Calendar
-   Open completely offline

------------------------------------------------------------------------

## 🔐 Privacy First

Your `.ics` file:

-   Never leaves your device
-   Is never uploaded
-   Is never stored
-   Is never tracked

All processing happens locally in your browser using:

-   ical.js
-   JSZip

------------------------------------------------------------------------

## ✨ Features

-   Expands recurring events (RRULE support)
-   Handles overrides and cancellations
-   Optional year range limiting
-   Optional stripping of descriptions/locations
-   Generates fully static HTML output
-   Zero dependencies after generation
-   Works offline

------------------------------------------------------------------------

## 🛠 How It Works

1.  Upload a `.ics` file.
2.  The builder:
    -   Parses events
    -   Expands recurrences
    -   Organizes events by date
    -   Generates static data files
3.  A ZIP file is generated.
4.  Unzip and open `index.html`.

That's it.

------------------------------------------------------------------------

## 📦 Generated Output Is Static

The output site:

-   Requires no server
-   Requires no database
-   Can be hosted anywhere
-   Can be archived permanently
-   Can be opened locally

It is a snapshot of your calendar.

------------------------------------------------------------------------

## 🏗 Tech Stack

-   Vanilla JavaScript
-   ical.js
-   JSZip
-   Static GitHub Pages hosting

No frameworks.\
No build step.\
No backend.

------------------------------------------------------------------------

## 📁 Project Structure

    index.html            → Builder UI
    builder.js            → ICS parser + ZIP generator
    style.css             → Builder styling

    viewer_template/
       index.html         → Static viewer shell
       assets/
          app.js          → Calendar UI logic
          style.css       → Viewer styling

------------------------------------------------------------------------

## 🌍 Why This Exists

Modern tools are powerful --- but dependent.

This project exists to:

-   Create portable calendar archives
-   Reduce dependency on live services
-   Preserve history in static form
-   Encourage personal data ownership

------------------------------------------------------------------------

## 🧩 Future Ideas

-   Dark mode
-   Calendar color preservation
-   Event tagging
-   Multiple calendar merging
-   Installable PWA version
-   Timeline view
-   Year heatmap visualization

------------------------------------------------------------------------

## ⚠️ Limitations

-   Extremely large calendars may take time to expand recurrences
-   Timezone handling depends on ICS formatting
-   Recurrence expansion is bounded by optional year limits

------------------------------------------------------------------------

## 🤝 Contributing

Pull requests and improvements are welcome.

------------------------------------------------------------------------

## 📜 License

MIT
