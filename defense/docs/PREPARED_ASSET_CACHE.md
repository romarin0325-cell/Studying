# Committed prepared asset cache

Defense already commits the final optimized WebPs in assets/moonlit,
assets/characters and assets/bosses. The HTML builder embeds those exact bytes;
it does not regenerate or re-encode them. A duplicate generated-assets directory
would only add a second copy of the same binaries.

assets/prepared-manifest.json is the committed validation cache. It records each
served file's SHA-256, byte count, transparency requirement, dimensions and alpha
validation result. The aggregate sourceHash covers these file hashes and their
transparency contracts. processorHash covers the validation/authoring scripts
(with CRLF normalized) and the locked Sharp version. It contains no machine paths,
timestamps or credentials and can be reused in a fresh checkout.

On a code/CSS/balance-only build, hashes match and the alpha inspector makes zero
Sharp metadata/stats/decode calls. A changed file is revalidated individually;
a changed processor fingerprint revalidates all alpha assets. Missing, corrupt
or opaque replacement assets fail; an invalid file never updates the last good
cache. The manifest is replaced atomically after every required file passes.

Commands:

- npm run prepare:defense-art: reuse valid records and refresh changed records.
- npm run prepare:defense-art -- --check --force: bypass all cached inspection
  results without modifying the committed manifest.
- npm run build:defense-local: validate/reuse prepared assets and embed WebPs.

Commit the changed WebPs and prepared-manifest.json together. CI performs the
uncached alpha check and requires both the manifest and generated HTML to match
the checkout. Unit tests cover zero-decode reuse, file/policy invalidation,
missing/opaque replacements, forced inspection and path containment.

This is a validation cache over already prepared Defense assets. It does not
claim that an unavailable original illustration is reproducible from a hash, or
automatically perform artistic approval. The offline authoring pipeline and
visual acceptance still apply when artwork changes.
