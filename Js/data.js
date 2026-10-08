/*
  사진 정보

  사진 목록(번호, 파일, 크기)은 Js/images.js 에 자동으로 만들어진다. 직접 고치지 않는다.
  image/ 폴더에 사진을 넣으면 tools/sync_images.py 가 목록을 갱신한다.

  이 파일에서는 사진별 분류와 설명만 적는다 (파일 이름으로 찾는다).
     - type / material: 아래 TYPES / MATERIALS 의 key 중 하나
     - title: 사진 설명 (캡션과 대체 텍스트)
     - place, date, note: 모르면 "" 로 두면 화면에서 숨겨진다
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

const META = {
  "cosmos_1256046000.webp": { type: "crack",  material: "asphalt",  title: "Crosswalk paint split into plates" },
  "cosmos_1716209337.webp": { type: "crack",  material: "concrete", title: "Cracks running through the skim coat" },
  "cosmos_633351661.webp":  { type: "crack",  material: "stone",    title: "Shattered floor tiles in shade" },
  "cosmos_247480032.webp":  { type: "patch",  material: "asphalt",  title: "Asphalt patch over a concrete edge" },
  "cosmos_1359013662.webp": { type: "patch",  material: "asphalt",  title: "Patch where the bike lane meets the curb" },
  "cosmos_301198596.webp":  { type: "patch",  material: "asphalt",  title: "Crosswalk stripes rebuilt over a patch" },
  "cosmos_446541103.webp":  { type: "patch",  material: "stone",    title: "Paving bricks filling a pothole" },
  "cosmos_368044132.webp":  { type: "line",   material: "asphalt",  title: "Center line painted across a manhole" },
  "cosmos_600602565.webp":  { type: "line",   material: "asphalt",  title: "Double line carried over a grate" },
  "cosmos_1656171333.webp": { type: "line",   material: "asphalt",  title: "Tire marks across a re-laid crossing" },
  "cosmos_1174180386.webp": { type: "breach", material: "concrete", title: "Rebar exposed through concrete" },
  "cosmos_2125478361.webp": { type: "breach", material: "stone",    title: "Manhole sunk into broken paving" },

  "cosmos_1199774207.webp": { type: "patch",  material: "stone",    title: "Mismatched tiles around a manhole" },
  "cosmos_1391313618.webp": { type: "breach", material: "stone",    title: "Pavers broken loose from the walk" },
  "cosmos_1391826561.webp": { type: "line",   material: "concrete", title: "White line painted across a cover" },
  "cosmos_1426149396.webp": { type: "line",   material: "asphalt",  title: "Double line stopping at a drain" },
  "cosmos_1721056967.webp": { type: "line",   material: "asphalt",  title: "Yellow chevrons painted over a grate" },
  "cosmos_176835170.webp":  { type: "breach", material: "asphalt",  title: "Asphalt crumbling at the edge" },
  "cosmos_1819016891.webp": { type: "patch",  material: "stone",    title: "Mosaic tiles set into a pothole" },
  "cosmos_1881768578.webp": { type: "line",   material: "asphalt",  title: "Faded arrow over cracked asphalt" },
  "cosmos_1915770204.webp": { type: "crack",  material: "stone",    title: "Hexagonal pavers cracked and sunken" },
  "cosmos_2145404130.webp": { type: "line",   material: "asphalt",  title: "Yellow lines meeting across a manhole" },
  "cosmos_258328225.webp":  { type: "breach", material: "stone",    title: "Wall tiles missing from their grid" },
  "cosmos_546065129.webp":  { type: "crack",  material: "stone",    title: "Yellow tiles shattered at the edge" },
  "cosmos_612862681.webp":  { type: "breach", material: "concrete", title: "Painted curb over a broken edge" },
  "cosmos_677260279.webp":  { type: "breach", material: "concrete", title: "Concrete pole crumbling around a fixture" },
  "cosmos_845816097.webp":  { type: "line",   material: "asphalt",  title: "Line painted across a sunken cover" },
  "cosmos_962488128.webp":  { type: "line",   material: "asphalt",  title: "Crosswalk paint meeting a red curb" },
  "cosmos_993554637.webp":  { type: "breach", material: "asphalt",  title: "Water rising through a bike lane" }
};

// IMAGES (Js/images.js) + META → the list the site uses
const REPAIRS = IMAGES.map(img => ({
  type: "unsorted",
  material: "unsorted",
  title: `Photograph ${img.id}`,
  place: "",
  date: "",
  note: "",
  ...img,
  ...(META[img.file] || {})
}));
