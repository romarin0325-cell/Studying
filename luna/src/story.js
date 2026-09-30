/* An original, non-canon fiction. Luna is a fictional character in this game. */
(function(root){'use strict';
const chapters=[
 {title:'01 · 접힌 세계',fragment:'봄',emotion:'thinking',body:'미완의 세계는 폐기한다.\n그것이 내게 주어진 일이었다.\n\n그런데 첫 보관함에서, 편지 하나가 말했다.\n“내가 사라지면 봄이 왔다는 걸 누가 알지?”\n\n이름은 봄. 수신인은 아직 없었다.\n…수신인 정도는 내가 되어도 되겠네.',keep:'편지의 이름을 남긴다',release:'정리 명령을 따른다'},
 {title:'02 · 미완의 온실',fragment:'여울',emotion:'warm',body:'편지가 있던 곳에는 온실이 연결돼 있었다.\n꽃은 피지 않았고, 물소리만 남았다.\n\n“내 이름은 여울. 바다가 없어도 흐를 수 있을까?”\n\n모든 질문에 답을 줄 수는 없다.\n하지만 질문이 머물 자리는 만들 수 있다.\n그건 내 일이 아니라고? 이제 정하면 되지.',keep:'물소리가 머물 자리를 만든다',release:'온실을 정리하고 회복한다'},
 {title:'03 · 이름의 자리',fragment:'다음',emotion:'resolve',body:'마지막 문에는 이름도 번호도 없었다.\n\n최종 정리자: “너는 정리를 위해 만들어졌다.\n왜 빈자리를 채우지?”\n\n루나. 처음엔 그렇게 불리라는 지시였다.\n지금은 내가 한 선택들이 모여 있는 이름이다.\n\n이 문 너머에는 아무것도 없다.\n그래서, 다음이 들어올 수 있다.',keep:'아직 없는 다음을 위해 문을 남긴다',release:'빈 문을 닫고 마지막으로 향한다'}
];
const endings={
 keep:{title:'여기에, 루나',emotion:'warm',body:'정리자의 기록에 처음으로 빈 줄이 생겼다.\n그 자리에 루나는 주소를 적었다.\n\n“끝나지 않은 것은, 여기로.”\n\n완벽한 세계는 아니었다. 편지는 젖었고,\n온실은 작은 화분 하나뿐이고, 문은 삐걱거렸다.\n그래도 누군가는 봄을 기다릴 수 있었다.\n\n루나는 맡겨진 일을 넘어, 맡을 일을 골랐다.\n그것이 이 이름의 첫 번째 의미였다.'},
 mixed:{title:'남긴 것의 무게',emotion:'thinking',body:'모든 것을 가지고 올 수는 없었다.\n남기기로 한 이름과, 닫기로 한 문.\n둘 다 루나의 손에 남았다.\n\n루나는 작은 보관함을 만들었다.\n“다음에는 더 잘 고를 거야.”\n\n정답이 적힌 명령서는 더는 없었다.\n대신, 자신의 선택을 돌아볼 이름이 있었다.\n그 이름으로 다시 문을 열었다.'},
 release:{title:'정리되지 않은 한 줄',emotion:'thinking',body:'마지막 문이 닫혔다.\n정리 목록은 비어 있었고, 임무는 끝났다.\n\n루나는 완료란 아래에 한 줄을 덧붙였다.\n“다음에는, 사라지기 전에 물어볼 것.”\n\n이번에는 아무것도 남기지 않았다.\n그 사실까지 지우고 싶지는 않았다.\n\n루나라는 이름은 아직 완성되지 않았다.\n이제, 그 다음을 선택할 수 있었다.'}
};
const endingFor=g=>g.choices.every(x=>x==='release')?'release':g.choices.filter(x=>x==='keep').length===3&&g.names>=12?'keep':'mixed';
const api={chapters,endings,endingFor};root.LunaStory=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
