/*
  사진 추가하는 방법
  1. 사진 파일을 image/ 폴더에 넣는다
  2. 아래 REPAIRS 목록에 한 줄 추가한다
     - file: 파일 이름
     - w, h: 사진의 가로·세로 픽셀 (비율 계산용. 터미널에서 sips -g pixelWidth -g pixelHeight 파일명)
     - type / material: 아래 TYPES / MATERIALS 의 key 중 하나
     - place, date, note: 모르면 "" 로 두면 화면에서 숨겨진다
  title 과 분류는 사진을 보고 붙인 초안이다. 자유롭게 고쳐서 쓰면 된다.
*/

const TYPES = [
  { key: "crack",  label: "Crack" },
  { key: "patch",  label: "Patch" },
  { key: "line",   label: "Line" },
  { key: "breach", label: "Breach" }
];

const MATERIALS = [
  { key: "asphalt",  label: "Asphalt" },
  { key: "concrete", label: "Concrete" },
  { key: "stone",    label: "Stone & Tile" }
];

const REPAIRS = [
  { id: "IR-01", file: "cosmos_1256046000.webp", w: 2756, h: 2756, type: "crack",  material: "asphalt",  title: "Crosswalk paint split into plates",       place: "", date: "", note: "" },
  { id: "IR-02", file: "cosmos_1716209337.webp", w: 699,  h: 873,  type: "crack",  material: "concrete", title: "Cracks running through the skim coat",    place: "", date: "", note: "" },
  { id: "IR-03", file: "cosmos_633351661.webp",  w: 1080, h: 870,  type: "crack",  material: "stone",    title: "Shattered floor tiles in shade",          place: "", date: "", note: "" },
  { id: "IR-04", file: "cosmos_247480032.webp",  w: 844,  h: 1182, type: "patch",  material: "asphalt",  title: "Asphalt patch over a concrete edge",      place: "", date: "", note: "" },
  { id: "IR-05", file: "cosmos_1359013662.webp", w: 800,  h: 1066, type: "patch",  material: "asphalt",  title: "Patch where the bike lane meets the curb", place: "", date: "", note: "" },
  { id: "IR-06", file: "cosmos_301198596.webp",  w: 1440, h: 1800, type: "patch",  material: "asphalt",  title: "Crosswalk stripes rebuilt over a patch",  place: "", date: "", note: "" },
  { id: "IR-07", file: "cosmos_446541103.webp",  w: 1080, h: 1350, type: "patch",  material: "stone",    title: "Paving bricks filling a pothole",         place: "", date: "", note: "" },
  { id: "IR-08", file: "cosmos_368044132.webp",  w: 480,  h: 640,  type: "line",   material: "asphalt",  title: "Center line painted across a manhole",    place: "", date: "", note: "" },
  { id: "IR-09", file: "cosmos_600602565.webp",  w: 613,  h: 612,  type: "line",   material: "asphalt",  title: "Double line carried over a grate",        place: "", date: "", note: "" },
  { id: "IR-10", file: "cosmos_1656171333.webp", w: 750,  h: 933,  type: "line",   material: "asphalt",  title: "Tire marks across a re-laid crossing",    place: "", date: "", note: "" },
  { id: "IR-11", file: "cosmos_1174180386.webp", w: 1080, h: 1331, type: "breach", material: "concrete", title: "Rebar exposed through concrete",          place: "", date: "", note: "" },
  { id: "IR-12", file: "cosmos_2125478361.webp", w: 1080, h: 810,  type: "breach", material: "stone",    title: "Manhole sunk into broken paving",         place: "", date: "", note: "" }
];
