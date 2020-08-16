const gulp = require('gulp');
const zip = require('gulp-zip');
const fs = require('fs');
const csso = require('csso');
const terser = require("terser");
const spawnSync = require('child_process').spawnSync;
const  _7z = require('7zip')['7z']
const path = require('path');


const debugBuild = false;


async function zip7(inputFilename, zipFilename) {
  let result = spawnSync(_7z, ['a', zipFilename, '-y', '-mx9', inputFilename]);
  if ( result.error ) {
    console.log( '' + result.error );
  }
  //console.log( '' + result.output );
}



async function buildCode() {
  let source = {};

  let order = [
    'init.js',
    'math.js', 
    'material.js', 
    'geometry.js', 
    'person.js',
    'entry.js'
  ];

  for ( let i of order ) {
    source[i] = fs.readFileSync(`source/${i}`, 'utf8');
  }

  var options = {
    mangle: {
      toplevel: true,
      properties: false
    },
    compress: {
      defaults: true,
      drop_console: !debugBuild,
      ecma: 8,
      keep_fargs: false,
      passes: 10,
      toplevel: true,
      unsafe: true,
      unsafe_arrows: true,
      unsafe_math: true
    },
    output: {
      ecma: 8
    },
    nameCache: {}
  };

  if ( debugBuild ) {
    options.sourceMap = {
      filename: 'packed.js',
      url: '../packed.js.map'
    }
  }

  let js = await terser.minify(source, options);

  if ( !debugBuild ) {

    let propMangles = [
      'root',
      'pelvis',
      'spine',
      'chest',
      'head',
      'leftThigh',
      'rightThigh',
      'leftCalf',
      'rightCalf',
      'leftFoot',
      'rightFoot',
      'leftUpperArm',
      'rightUpperArm',
      'leftLowerArm',
      'rightLowerArm',
      'leftHand',
      'rightHand',
    ]

    for ( let i=0; i<propMangles.length; ++i ) {
      let prop = propMangles[i];
      let replacement = String.fromCharCode( 'a'.charCodeAt(0) + i );
      let test = new RegExp( '\\.' + prop, 'g' );
      js.code = js.code.replace( test, '.' + replacement );
    }

  }

  if ( js.warnings ) {
    console.warn( js.warnings );
  }

  if ( js.error ) {
    console.error( js.error );
    broken = true;
    return null;
  }

  return js;
}

async function build() {
  let html = fs.readFileSync('source/index.html', 'utf8');

  let broken = false;

  let code = await buildCode();
  if ( code ) {
    html = html.replace("{{SCRIPTCONTENTS}}", code.code);
    fs.writeFileSync('source/packed.js.map', code.map, 'utf8');
  } else {
    broken = true;
  }
  
  let cssSource = fs.readFileSync('source/main.css', 'utf8');
  let css = csso.minify(cssSource);
  html = html.replace("{{CSSCONTENTS}}", `<style>${css.css}</style>`);
  
  if ( !broken ) {
    fs.writeFileSync('source/site/index.html', html, 'utf8');

    let complete = () => {
      let info = fs.statSync('build/404CLUB.zip');
      let p = info.size / 13312 * 100;
      let t = (new Date).toLocaleString();
      let report = `${t} zip size: ${info.size}b / 13312b, ${p.toFixed(2)}%`;
      console.log(report);
      fs.appendFileSync('history.log', report + '\n');
    }
   
    if ( process.platform == 'win32' ) {
      await zip7(
        path.normalize( path.join( __dirname, 'source', 'site', '*' ) ),
        path.normalize( path.join( __dirname, 'build', '404CLUB.zip' ) )
      );
      complete();
    } else {
      gulp.src('source/site/*')
      .pipe(zip('404CLUB.zip'))
      .pipe(gulp.dest('build'))
      .on('end', complete);
    } 
  }
}

//build();

const chokidar = require('chokidar');

let debounce = null;

const excludes = [ 'source/packed.js.map', 'source/site/index.html' ];

chokidar.watch('source').on('all', (event, path) => {
  path = path.replace(/\\/g, '/');
  console.log(event, path);
  if ( debounce ) { 
    return;
  }
  if ( excludes.find( s => s === path ) ) {
    return;
  }
  debounce = setTimeout( () => {
    build();
    debounce = null;
  }, 200 );
});