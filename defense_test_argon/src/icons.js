// Original code-native UI icons: one SVG sprite lives in index.html, this helper references it.
// Stroke icons inherit color from the parent; gem and dust carry their own gradients.
export const icon=(name,cls='')=>`<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
