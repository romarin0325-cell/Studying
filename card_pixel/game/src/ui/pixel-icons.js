// Small pixel icons drawn as SVG, for menu buttons that have no painted icon.
// Each row is 16 cells: '.' is empty, a letter picks the icon's palette colour.
const ICONS = {
  book: {
    palette: { o: '#29266a', d: '#c22f6f', p: '#ff5c9d', W: '#ffffff', w: '#f3eefe', g: '#ffc23a' },
    rows: [
      '................',
      '...ooooooooooo..',
      '..odpppppppppwo.',
      '..odpppppppppwo.',
      '..odppWWWWWppwo.',
      '..odppWWWWWppwo.',
      '..odpppppppppwo.',
      '..odpppppppppwo.',
      '..odpppppppppwo.',
      '..odpppppppppwo.',
      '..odpppppppppwo.',
      '..odpppppppppwo.',
      '..odwwwwwwwwwwo.',
      '..ooooooooogooo.',
      '...........g....',
      '................'
    ]
  },
  lock: {
    palette: { o: '#29266a', S: '#c9c3e6', G: '#ffc23a', Y: '#d98a12' },
    rows: [
      '................',
      '................',
      '......oooo......',
      '.....oSSSSo.....',
      '....oSo..oSo....',
      '....oSo..oSo....',
      '....oSo..oSo....',
      '..oooooooooooo..',
      '..oGGGGGGGGGGo..',
      '..oGGGGooGGGGo..',
      '..oGGGGooGGGGo..',
      '..oGGGGooGGGGo..',
      '..oYYYYYYYYYYo..',
      '..oooooooooooo..',
      '................',
      '................'
    ]
  },
  telescope: {
    palette: { o: '#29266a', y: '#ffc23a', Y: '#d98a12', a: '#63e8dd' },
    rows: [
      '................',
      '...........ooo..',
      '.........ooyyao.',
      '.......ooyyyyao.',
      '.....ooyyyyyoo..',
      '...ooyyyyyoo....',
      '..oYyyyyoo......',
      '..oYyyoo........',
      '...ooo.oo.......',
      '......o..o......',
      '.....o....o.....',
      '....o......o....',
      '...o........o...',
      '................',
      '................',
      '................'
    ]
  }
};

export function pixelIcon(name, size = 32) {
  const { palette, rows } = ICONS[name];
  let cells = '';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const colour = palette[row[x]];
      let width = 1;
      while (colour && row[x + width] === row[x]) width++;
      if (colour) cells += `<rect x="${x}" y="${y}" width="${width}" height="1" fill="${colour}"/>`;
      x += width;
    }
  });
  return `<svg class="pxi" viewBox="0 0 16 16" width="${size}" height="${size}" shape-rendering="crispEdges" aria-hidden="true">${cells}</svg>`;
}
