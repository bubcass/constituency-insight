import test from "node:test";
import assert from "node:assert/strict";

import {
  buildConstituencyUrl,
  constituencySlug,
  resolveConstituencyUrlState,
} from "../src/components/constituency-url-state.js";

const constituencies = ["Laois", "Louth", "Dún Laoghaire"];

test("creates stable constituency slugs", () => {
  assert.equal(constituencySlug("Dún Laoghaire"), "dun-laoghaire");
});

test("resolves a valid constituency and safely rejects an unknown one", () => {
  assert.equal(
    resolveConstituencyUrlState({constituencies, search: "?constituency=louth"}),
    "Louth"
  );
  assert.equal(
    resolveConstituencyUrlState({constituencies, search: "?constituency=unknown"}),
    null
  );
});

test("builds a canonical URL while preserving unrelated state", () => {
  assert.equal(
    buildConstituencyUrl("Dún Laoghaire", "https://example.test/housing?ref=home#overview").href,
    "https://example.test/housing?ref=home&constituency=dun-laoghaire#overview"
  );
});
