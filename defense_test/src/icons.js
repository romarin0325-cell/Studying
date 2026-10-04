// Original code-native UI art: distinct silhouettes remain legible at 24px.
const paths={
  home:'M3 11 12 3l9 8v10h-6v-6H9v6H3z',
  collection:'M4 4h13v16H4z M8 1h13v16 M7 8h7 M7 12h5 M7 16h7',
  adventure:'M12 2 21 12 12 22 3 12z M16 8l-3 6-5 2 3-6z',
  summon:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z',
  dispatch:'M2 5h20l-8 8-2 9-4-7z M8 15l14-10',
  leaf:'M4 20C2 9 8 3 21 3c0 13-6 19-17 17Zm0 0L16 8',
  clock:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4v6l4 3',
  crown:'m3 7 4 4 5-7 5 7 4-4-2 12H5z',
  check:'m4 12 5 5L20 6',
  lock:'M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4',
};
export const icon=(name,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.summon}"/></svg>`;
