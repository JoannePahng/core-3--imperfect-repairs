/*
  사진 정보

  사진 목록(번호, 파일, 크기)은 Js/images.js 에 자동으로 만들어진다. 직접 고치지 않는다.
  image/ 폴더에 사진을 넣으면 tools/sync_images.py 가 목록을 갱신한다.

  이 파일에서는 사진별 분류와 설명만 적는다 (파일 이름으로 찾는다).
     - type / material: 아래 TYPES / MATERIALS 의 key 중 하나
     - title: 사진 설명 (캡션과 대체 텍스트)
     - place, date, note: 모르면 "" 로 두면 화면에서 숨겨진다
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

// lat / lng below are placeholder positions spread across Manhattan so the map
// can be laid out. Replace each with the real place the photograph was taken.
const META = {
  "cosmos_1256046000.webp": { type: "crack",  material: "asphalt",  title: "Crosswalk paint split into plates", lat: 40.7037, lng: -74.015 },
  "cosmos_1716209337.webp": { type: "crack",  material: "concrete", title: "Cracks running through the skim coat", lat: 40.7064, lng: -74.011 },
  "cosmos_633351661.webp":  { type: "crack",  material: "stone",    title: "Shattered floor tiles in shade", lat: 40.756, lng: -73.965 },
  "cosmos_247480032.webp":  { type: "patch",  material: "asphalt",  title: "Asphalt patch over a concrete edge", lat: 40.7735, lng: -73.9822 },
  "cosmos_1359013662.webp": { type: "patch",  material: "asphalt",  title: "Patch where the bike lane meets the curb", lat: 40.7149, lng: -74.008 },
  "cosmos_301198596.webp":  { type: "patch",  material: "asphalt",  title: "Crosswalk stripes rebuilt over a patch", lat: 40.769, lng: -73.962 },
  "cosmos_446541103.webp":  { type: "patch",  material: "stone",    title: "Paving bricks filling a pothole", lat: 40.7832, lng: -73.979 },
  "cosmos_368044132.webp":  { type: "line",   material: "asphalt",  title: "Center line painted across a manhole", lat: 40.7775, lng: -73.951 },
  "cosmos_600602565.webp":  { type: "line",   material: "asphalt",  title: "Double line carried over a grate", lat: 40.7935, lng: -73.9723 },
  "cosmos_1656171333.webp": { type: "line",   material: "asphalt",  title: "Tire marks across a re-laid crossing", lat: 40.7168, lng: -73.9985 },
  "cosmos_1174180386.webp": { type: "breach", material: "concrete", title: "Rebar exposed through concrete", lat: 40.7187, lng: -73.988 },
  "cosmos_2125478361.webp": { type: "breach", material: "stone",    title: "Manhole sunk into broken paving", lat: 40.7253, lng: -73.9967 },

  "cosmos_1199774207.webp": { type: "patch",  material: "stone",    title: "Mismatched tiles around a manhole", lat: 40.7322, lng: -74.003 },
  "cosmos_1391313618.webp": { type: "breach", material: "stone",    title: "Pavers broken loose from the walk", lat: 40.7255, lng: -73.9836 },
  "cosmos_1391826561.webp": { type: "line",   material: "concrete", title: "White line painted across a cover", lat: 40.7398, lng: -74.003 },
  "cosmos_1426149396.webp": { type: "line",   material: "asphalt",  title: "Double line stopping at a drain", lat: 40.7406, lng: -73.9862 },
  "cosmos_1721056967.webp": { type: "line",   material: "asphalt",  title: "Yellow chevrons painted over a grate", lat: 40.7462, lng: -74.005 },
  "cosmos_176835170.webp":  { type: "breach", material: "asphalt",  title: "Asphalt crumbling at the edge", lat: 40.7896, lng: -73.9473 },
  "cosmos_1819016891.webp": { type: "patch",  material: "stone",    title: "Mosaic tiles set into a pothole", lat: 40.7505, lng: -73.991 },
  "cosmos_1881768578.webp": { type: "line",   material: "asphalt",  title: "Faded arrow over cracked asphalt", lat: 40.7505, lng: -73.972 },
  "cosmos_1915770204.webp": { type: "crack",  material: "stone",    title: "Hexagonal pavers cracked and sunken", lat: 40.7614, lng: -73.9905 },
  "cosmos_2145404130.webp": { type: "line",   material: "asphalt",  title: "Yellow lines meeting across a manhole", lat: 40.7637, lng: -73.9734 },
  "cosmos_258328225.webp":  { type: "breach", material: "stone",    title: "Wall tiles missing from their grid", lat: 40.8, lng: -73.958 },
  "cosmos_546065129.webp":  { type: "crack",  material: "stone",    title: "Yellow tiles shattered at the edge", lat: 40.8079, lng: -73.964 },
  "cosmos_612862681.webp":  { type: "breach", material: "concrete", title: "Painted curb over a broken edge", lat: 40.8085, lng: -73.9452 },
  "cosmos_677260279.webp":  { type: "breach", material: "concrete", title: "Concrete pole crumbling around a fixture", lat: 40.8196, lng: -73.9505 },
  "cosmos_845816097.webp":  { type: "line",   material: "asphalt",  title: "Line painted across a sunken cover", lat: 40.8243, lng: -73.9446 },
  "cosmos_962488128.webp":  { type: "line",   material: "asphalt",  title: "Crosswalk paint meeting a red curb", lat: 40.8405, lng: -73.9397 },
  "cosmos_993554637.webp":  { type: "breach", material: "asphalt",  title: "Water rising through a bike lane", lat: 40.8517, lng: -73.9389 }
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
