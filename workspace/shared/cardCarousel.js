(function(){
  'use strict';

  function initCardCarousel(track){
    if (!track || track.dataset.ccCarouselReady === '1') return;
    track.dataset.ccCarouselReady = '1';
    track.classList.add('cc-card-track');

    const wrapper = document.createElement('div');
    wrapper.className = 'cc-card-carousel';
    track.parentNode.insertBefore(wrapper, track);
    wrapper.appendChild(track);

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'cc-card-arrow cc-card-arrow-prev';
    prev.setAttribute('aria-label','Ver card anterior');
    prev.innerHTML = '<i class="bi bi-chevron-left" aria-hidden="true"></i>';

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'cc-card-arrow cc-card-arrow-next';
    next.setAttribute('aria-label','Ver próximo card');
    next.innerHTML = '<i class="bi bi-chevron-right" aria-hidden="true"></i>';

    wrapper.append(prev,next);

    function cardStep(){
      const first = track.querySelector('.stat-card');
      if (!first) return track.clientWidth;
      const gap = parseFloat(getComputedStyle(track).gap || '0') || 0;
      return first.getBoundingClientRect().width + gap;
    }

    function updateArrows(){
      const max = Math.max(0, track.scrollWidth - track.clientWidth);
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max - 2;
    }

    function move(direction){
      track.scrollBy({left: cardStep() * direction, behavior:'smooth'});
    }

    prev.addEventListener('click',()=>move(-1));
    next.addEventListener('click',()=>move(1));
    track.addEventListener('scroll',()=>requestAnimationFrame(updateArrows),{passive:true});
    window.addEventListener('resize',updateArrows,{passive:true});

    if ('ResizeObserver' in window) new ResizeObserver(updateArrows).observe(track);
    requestAnimationFrame(updateArrows);
  }

  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('.stats-grid,.admin-grid-6').forEach(initCardCarousel);
  });
})();
