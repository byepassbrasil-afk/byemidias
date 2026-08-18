const postcss = require('postcss');
const tailwind = require('tailwindcss');
const autoprefixer = require('autoprefixer');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '../apps/web/src/app/globals.css'), 'utf8');
const config = path.join(__dirname, '../apps/web/tailwind.config.js');

postcss([tailwind(config), autoprefixer])
  .process(css, { from: undefined })
  .then(r => {
    console.log('Output size:', r.css.length, 'bytes');
    console.log('First 500 chars:\n', r.css.substring(0, 500));
  })
  .catch(e => console.error('ERROR:', e.message));
