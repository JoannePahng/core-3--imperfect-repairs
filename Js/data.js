/*
  사진 정보

  사진 목록(번호, 파일, 크기)은 Js/images.js 에 자동으로 만들어진다. 직접 고치지 않는다.
  image/ 폴더에 사진을 넣으면 tools/sync_images.py 가 목록을 갱신한다.

  이 파일에서는 사진별 분류와 설명만 적는다 (파일 이름으로 찾는다).
     - type / material: 아래 TYPES / MATERIALS 의 key 중 하나
     - title: 사진 설명 (캡션과 대체 텍스트)
     - place, date, note: 모르면 "" 로 두면 화면에서 숨겨진다
     - excerpt: 책 인용문 key (아래 EXCERPTS 중 하나). 뷰어에 인용문으로 나타난다
     - lat, lng: 찍은 위치의 좌표. 넣으면 Map 에 핀으로 나타난다
       좌표 찾기: 사이트 주소 끝에 ?place 를 붙여 열고 Map 에서 위치를 클릭하면
       붙여넣을 한 줄이 나오고 복사된다. 예) { type: ..., lat: 40.72281, lng: -73.99654 }
  여기 없는 사진은 "Unsorted" 로 표시된다.
  title 과 분류는 사진을 보고 붙인 초안이다. 자유롭게 고쳐서 쓰면 된다.
*/

const TYPES = [
  { key: "crack",    label: "Crack" },
  { key: "patch",    label: "Patch" },
  { key: "line",     label: "Line" },
  { key: "breach",   label: "Breach" },
  { key: "unsorted", label: "Unsorted" }
];

const MATERIALS = [
  { key: "asphalt",  label: "Asphalt" },
  { key: "concrete", label: "Concrete" },
  { key: "stone",    label: "Stone & Tile" },
  { key: "unsorted", label: "Unsorted" }
];

// Passages from the book, Beauty in Imperfect Repairs, quoted word for word.
// Each photograph points to one with  excerpt: "key"  in META below.
const EXCERPTS = {
  "tar": { theme: "On material friction", text: "As liquid tar bleeds into a jagged fissure, its high viscosity causes it to follow the exact topography of the crack under the pull of gravity. The resulting jet-black, slightly reflective line contrasts sharply against the matte, coarse grain of the surrounding concrete pavement." },
  "brush": { theme: "On material friction", text: "Free from the constraints of engineered geometry, these black lines flow across the street like gestural brushstrokes or modern calligraphic strokes on an expansive urban canvas, offering a surprisingly expressive graphic quality born entirely out of structural necessity." },
  "collage": { theme: "On material friction", text: "The insertion of an off-color paving block or a raw slab of poured mortar breaks the uniform grid of the original pavement. This disruption introduces a collage-like quality, where weathered, vintage pavers sit directly against fresh, unpolished cement." },
  "grid": { theme: "On material friction", text: "The grid is no longer a passive background; it becomes an active, layered surface that mirrors the visual density of abstract textile patchwork or architectural assemblage." },
  "archive": { theme: "On material friction", text: "By stripping away the illusion of seamless permanence, these improvised interventions turn everyday urban flaws into a dynamic, constantly evolving archive of material resilience." },
  "rebar": { theme: "On the causes", text: "Minor execution variances, such as improper rebar spacing, inadequate sealant curing, or skipped waterproofing layers, go unnoticed during key sign-off phases, embedding latent defects deep within the building envelope." },
  "mix": { theme: "On the causes", text: "Even subtle variances in concrete mix designs—often introduced to offset raw material shortages—can fundamentally alter curing dynamics, leading to micro-fissures and compromised compressive strength long before maximum load is applied." },
  "schedule": { theme: "On the causes", text: "Under relentless deadline pressure, site managers are forced to fast-track sequential trades, causing overlapping workflows where finishing crews operate over incomplete structural substrates." },
  "communication": { theme: "On the causes", text: "Subcontractors frequently work off uncoordinated revisions, resulting in dimensional clashes, improperly routed MEP infrastructure, and costly, reactive field modifications." },
  "improvise": { theme: "On the causes", text: "When specialized adhesive systems arrive without required primer additives, or when custom-fabricated flashing is delayed, workers are incentivized to improvise using generic, store-bought alternatives to avoid costly work stoppages." },
  "tools": { theme: "On the causes", text: "Utilizing worn tool bits or uncalibrated cutting instruments introduces micro-abrasions along material edges, inducing stress concentrations that make glass, stone, or composite panels susceptible to delayed structural failure under thermal expansion." },
  "oversight": { theme: "On the causes", text: "Effective site supervision serves as the critical bridge between architectural intent and physical execution." },
  "labor": { theme: "On the causes", text: "This knowledge gap manifests in a fundamental misunderstanding of material properties, structural tolerances, and modern assembly techniques—turning routine installations into long-term structural vulnerabilities." },
  "poetic": { theme: "On the dual gaze", text: "On one hand lies an aestheticized gaze that frames deterioration as a poetic narrative—an asset to be curated, admired, and woven into cultural memory." },
  "stark": { theme: "On the dual gaze", text: "On the other lies a starker, unvarnished reading that sees imperfection not as art, but as raw vulnerability—an undeniable flaw that exposes structural frailty, historical trauma, or systemic abandonment." },
  "exposure": { theme: "On the dual gaze", text: "From this perspective, a crack is never merely a patina; it is an active point of exposure." },
  "time": { theme: "On the dual gaze", text: "Under this view, weathered stone, patinated bronze, and cracked masonry cease to signify failure; they become marks of authenticity and historical resonance." },
  "contested": { theme: "On the dual gaze", text: "By examining where these views diverge and overlap, the imperfect surface emerges as a contested terrain—a site where society continuously negotiates the boundaries between beauty, repair, and truth." },
  "care": { theme: "On care and memory", text: "Rather than signaling neglect, imperfection often serves as an asset, carrying cultural memory and sustaining the genius loci of a space." },
  "dilemma": { theme: "On care and memory", text: "Embracing imperfection requires navigating a fine line between active, thoughtful care and passive neglect." },
  "negative": { theme: "On everyday aesthetics", text: "As the framework of negative aesthetics asserts, certain manifestations of physical damage—such as crumbling structural supports, toxic contamination, or neglected public housing—must maintain their negative evaluative charge." },
  "discern": { theme: "On everyday aesthetics", text: "Society must learn to differentiate between the organic, narrative-rich weathering of materials and the hazardous degradation resulting from systemic neglect." },
  "pristine": { theme: "On everyday aesthetics", text: "Perfectly viable objects, architectural components, and public infrastructure are routinely discarded or demolished simply because they exhibit surface patinas or minor cosmetic defects." },
  "mend": { theme: "On ecological aesthetics", text: "Drawing on philosophical traditions such as wabi-sabi and kintsugi, which celebrate the beauty of the broken and mended, modern architecture must construct a narrative centered on repairability." },
  "weather": { theme: "On ecological aesthetics", text: "Surfaces weather, materials age, and patinas develop; these physical transformations are not signs of failure, but markers of material authenticity and structural durability." }
};

// lat / lng below are placeholder positions spread across Manhattan so the map
// can be laid out. Replace each with the real place the photograph was taken.
const META = {
  "cosmos_1256046000.webp": { type: "crack",  material: "asphalt",  title: "Crosswalk paint split into plates", lat: 40.7037, lng: -74.015, excerpt: "exposure" },
  "cosmos_1716209337.webp": { type: "crack",  material: "concrete", title: "Cracks running through the skim coat", lat: 40.7064, lng: -74.011, excerpt: "mix" },
  "cosmos_633351661.webp":  { type: "crack",  material: "stone",    title: "Shattered floor tiles in shade", lat: 40.756, lng: -73.965, excerpt: "tools" },
  "cosmos_247480032.webp":  { type: "patch",  material: "asphalt",  title: "Asphalt patch over a concrete edge", lat: 40.7735, lng: -73.9822, excerpt: "tar" },
  "cosmos_1359013662.webp": { type: "patch",  material: "asphalt",  title: "Patch where the bike lane meets the curb", lat: 40.7149, lng: -74.008, excerpt: "schedule" },
  "cosmos_301198596.webp":  { type: "patch",  material: "asphalt",  title: "Crosswalk stripes rebuilt over a patch", lat: 40.769, lng: -73.962, excerpt: "weather" },
  "cosmos_446541103.webp":  { type: "patch",  material: "stone",    title: "Paving bricks filling a pothole", lat: 40.7832, lng: -73.979, excerpt: "improvise" },
  "cosmos_368044132.webp":  { type: "line",   material: "asphalt",  title: "Center line painted across a manhole", lat: 40.7775, lng: -73.951, excerpt: "communication" },
  "cosmos_600602565.webp":  { type: "line",   material: "asphalt",  title: "Double line carried over a grate", lat: 40.7935, lng: -73.9723, excerpt: "brush" },
  "cosmos_1656171333.webp": { type: "line",   material: "asphalt",  title: "Tire marks across a re-laid crossing", lat: 40.7168, lng: -73.9985, excerpt: "dilemma" },
  "cosmos_1174180386.webp": { type: "breach", material: "concrete", title: "Rebar exposed through concrete", lat: 40.7187, lng: -73.988, excerpt: "rebar" },
  "cosmos_2125478361.webp": { type: "breach", material: "stone",    title: "Manhole sunk into broken paving", lat: 40.7253, lng: -73.9967, excerpt: "negative" },

  "cosmos_1199774207.webp": { type: "patch",  material: "stone",    title: "Mismatched tiles around a manhole", lat: 40.7322, lng: -74.003, excerpt: "collage" },
  "cosmos_1391313618.webp": { type: "breach", material: "stone",    title: "Pavers broken loose from the walk", lat: 40.7255, lng: -73.9836, excerpt: "oversight" },
  "cosmos_1391826561.webp": { type: "line",   material: "concrete", title: "White line painted across a cover", lat: 40.7398, lng: -74.003, excerpt: "poetic" },
  "cosmos_1426149396.webp": { type: "line",   material: "asphalt",  title: "Double line stopping at a drain", lat: 40.7406, lng: -73.9862, excerpt: "labor" },
  "cosmos_1721056967.webp": { type: "line",   material: "asphalt",  title: "Yellow chevrons painted over a grate", lat: 40.7462, lng: -74.005, excerpt: "archive" },
  "cosmos_176835170.webp":  { type: "breach", material: "asphalt",  title: "Asphalt crumbling at the edge", lat: 40.7896, lng: -73.9473, excerpt: "stark" },
  "cosmos_1819016891.webp": { type: "patch",  material: "stone",    title: "Mosaic tiles set into a pothole", lat: 40.7505, lng: -73.991, excerpt: "mend" },
  "cosmos_1881768578.webp": { type: "line",   material: "asphalt",  title: "Faded arrow over cracked asphalt", lat: 40.7505, lng: -73.972, excerpt: "time" },
  "cosmos_1915770204.webp": { type: "crack",  material: "stone",    title: "Hexagonal pavers cracked and sunken", lat: 40.7614, lng: -73.9905, excerpt: "grid" },
  "cosmos_2145404130.webp": { type: "line",   material: "asphalt",  title: "Yellow lines meeting across a manhole", lat: 40.7637, lng: -73.9734, excerpt: "contested" },
  "cosmos_258328225.webp":  { type: "breach", material: "stone",    title: "Wall tiles missing from their grid", lat: 40.8, lng: -73.958, excerpt: "care" },
  "cosmos_546065129.webp":  { type: "crack",  material: "stone",    title: "Yellow tiles shattered at the edge", lat: 40.8079, lng: -73.964, excerpt: "pristine" },
  "cosmos_612862681.webp":  { type: "breach", material: "concrete", title: "Painted curb over a broken edge", lat: 40.8085, lng: -73.9452, excerpt: "discern" },
  "cosmos_677260279.webp":  { type: "breach", material: "concrete", title: "Concrete pole crumbling around a fixture", lat: 40.8196, lng: -73.9505, excerpt: "negative" },
  "cosmos_845816097.webp":  { type: "line",   material: "asphalt",  title: "Line painted across a sunken cover", lat: 40.8243, lng: -73.9446, excerpt: "communication" },
  "cosmos_962488128.webp":  { type: "line",   material: "asphalt",  title: "Crosswalk paint meeting a red curb", lat: 40.8405, lng: -73.9397, excerpt: "schedule" },
  "cosmos_993554637.webp":  { type: "breach", material: "asphalt",  title: "Water rising through a bike lane", lat: 40.8517, lng: -73.9389, excerpt: "rebar" }
};

// IMAGES (Js/images.js) + META → the list the site uses
const REPAIRS = IMAGES.map(img => ({
  type: "unsorted",
  material: "unsorted",
  title: `Photograph ${img.id}`,
  place: "",
  date: "",
  note: "",
  lat: null,
  lng: null,
  ...img,
  ...(META[img.file] || {})
}));
