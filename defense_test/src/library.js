// Rumi's star library (루미의 별의 서재): once a day the player picks one wrong answer and hears Rumi explain it;
// each explanation lights one star. A finished constellation unlocks its Rumi illustration and opens the next one.
// Star coordinates are in a 100x100 sky; lines join star indices.
// ratio: width/height of the painting, so its frame has the painting's own shape.
const C=(id,name,title,line,stars,lines,ratio)=>({id,name,title,line,stars,lines,ratio});
export const CONSTELLATIONS=Object.freeze([
  C('boat','종이배자리','종이배를 날리는 루미','형아! 이 종이배가 닿는 곳까지, 루미가 같이 가 줄게!',
    [[18,58],[32,70],[50,73],[68,70],[82,58],[50,58],[50,26]],[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[5,6],[6,3]],720/540),
  C('hat','모자자리','모자를 든 루미','형아가 공부한 만큼, 루미 모자에 별이 하나씩 쌓여!',
    [[20,64],[34,60],[38,36],[50,22],[62,36],[66,60],[80,64],[50,62]],[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[1,7],[7,5]],608/1080),
  C('door','문자리','루미의 외출','오늘은 형아랑 서재 밖으로 산책 가는 날이야!',
    [[30,82],[30,52],[32,26],[50,14],[68,26],[70,52],[70,82],[60,54],[50,82]],[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[5,7],[6,8],[8,0]],720/900),
  C('window','창문자리','창가의 루미','형아가 틀렸던 문제, 이제 루미랑 같이 다 외웠지?',
    [[22,18],[50,14],[78,18],[78,50],[78,82],[50,86],[22,82],[22,50],[50,50],[50,32]],[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0],[1,9],[9,8],[8,5],[7,8],[8,3]],1),
  C('letter','편지자리','루미의 편지','형아한테 쓴 편지야. 노을이 지기 전에 읽어 줘!',
    [[16,28],[84,28],[84,52],[84,76],[50,76],[16,76],[16,52],[33,42],[50,56],[67,42]],[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,0],[0,7],[7,8],[8,9],[9,1]],614/1080),
  C('rabbit','토끼자리','마술사 루미','짠! 형아 눈을 빌려서… 별 하나를 꺼내 볼게!',
    [[40,12],[44,34],[56,12],[52,34],[48,46],[32,58],[36,80],[64,80],[68,58],[48,66],[78,40]],[[0,1],[2,3],[1,4],[3,4],[4,5],[5,6],[6,7],[7,8],[8,4],[4,9],[8,10]],720/900),
  C('moon','초승달자리','달의 루미','마지막 별까지 형아랑 같이 켰어. 이건 루미의 제일 소중한 하늘이야!',
    [[60,10],[42,16],[28,30],[22,48],[26,66],[38,80],[56,88],[70,84],[52,74],[42,58],[44,38],[54,24]],[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,0]],1),
]);
// Illustrations (assets/library, 720px webp made from the supplied Rumi art). The build embeds them as window.__LIBRARY_MEDIA__.
export const LIBRARY_ART=Object.freeze(Object.fromEntries(CONSTELLATIONS.map(c=>[c.id,`./assets/library/${c.id}.webp`])));
export const LIBRARY_STARS=CONSTELLATIONS.reduce((n,c)=>n+c.stars.length,0);
export const constellationAt=index=>CONSTELLATIONS[Math.min(index,CONSTELLATIONS.length-1)];
