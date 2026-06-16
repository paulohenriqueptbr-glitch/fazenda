const fs = require('fs');

const code = fs.readFileSync('app.backup.js', 'utf8');
const lines = code.split('\n');

const sliceAndExport = (filename, start, end) => {
    let content = lines.slice(start - 1, end).join('\n');
    // Add export to top-level declarations
    content = content.replace(/^(const|let|function)\s+([a-zA-Z0-9_]+)/gm, 'export $1 $2');
    fs.writeFileSync(`js/${filename}`, content);
    console.log(`Created js/${filename}`);
};

// Based on my previous analysis:
// 1-342: store.js (part 1: constants, state, config)
sliceAndExport('store.js', 1, 342);

// 343-426: dom.js (elements)
sliceAndExport('dom.js', 343, 426);

// 448-650: auth.js
sliceAndExport('auth.js', 448, 650);

// 651-1408: data.js (local storage, supabase, sync)
sliceAndExport('data.js', 651, 1408);

// 1409-1733: forms.js (validation, form handling)
sliceAndExport('forms.js', 1409, 1733);

// 1734-1873: alerts.js
sliceAndExport('alerts.js', 1734, 1873);

// 1874-1960: client.js (subscription, client panel)
sliceAndExport('client.js', 1874, 1960);

// 1961-2338: render.js
sliceAndExport('render.js', 1961, 2338);

// 2339-2378: weather.js
sliceAndExport('weather.js', 2339, 2378);

// 2379-2518: reports.js
sliceAndExport('reports.js', 2379, 2518);

// 2519-2559: export.js and print
sliceAndExport('export.js', 2519, 2559);

// 2560-2634: onboarding.js
sliceAndExport('onboarding.js', 2560, 2634);

// 2635-3067: init.js (initApp)
sliceAndExport('init.js', 2635, 3067);

// 3068-3293: session.js
sliceAndExport('session.js', 3068, 3293);

// 3294-end: push.js
sliceAndExport('push.js', 3294, lines.length);

console.log('Done slicing.');
