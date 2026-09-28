// Same document-level fullscreen flow as Shooter; prefixed Safari support and
// rejected requests leave the game playable. All dialogs stay inside the root.
export function bindFullscreen({toast,onChange}){
  const root=document.documentElement;
  const active=()=>document.fullscreenElement||document.webkitFullscreenElement;
  const sync=()=>{
    for(const button of document.querySelectorAll('[data-action="fullscreen"]')){
      button.setAttribute('aria-label',active()?'전체화면 나가기':'전체화면');
      button.setAttribute('aria-pressed',String(!!active()));
      button.title=active()?'전체화면 나가기':'전체화면';
    }
    requestAnimationFrame(onChange);
  };
  document.addEventListener('click',async event=>{
    if(!event.target.closest('[data-action="fullscreen"]'))return;
    try{
      if(active()){
        const exit=document.exitFullscreen||document.webkitExitFullscreen;
        if(exit)await exit.call(document);
      }else if(root.requestFullscreen){
        try{await root.requestFullscreen({navigationUI:'hide'});}
        catch{await root.requestFullscreen();}
      }else if(root.webkitRequestFullscreen)await root.webkitRequestFullscreen();
      else toast('이 브라우저는 전체화면을 지원하지 않습니다. 홈 화면에 추가해 실행해 보세요.');
    }catch{toast('전체화면으로 전환할 수 없습니다. 브라우저에서 전체화면을 허용해 주세요.');}
    sync();
  });
  document.addEventListener('fullscreenchange',sync);
  document.addEventListener('webkitfullscreenchange',sync);
  sync();
}
