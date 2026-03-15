/**
 * WikiHole - Main Application Logic v4
 * 
 * This is the core application that manages the interactive knowledge exploration
 * interface. It handles node creation, physics simulation, user interactions,
 * and visual effects for the knowledge graph visualization.
 * 
 * Key Features:
 * - Interactive knowledge graph with physics-based layout
 * - Two modes: Explore (branching) and Bridge (pathfinding)
 * - Custom cursor with trailing effects
 * - Animated starfield background
 * - Zoom/pan navigation with keyboard controls
 * - AI-powered connections via Groq API
 */

// Color palette for knowledge nodes - each node gets a unique color from this cycle
const NODE_COLORS = [
  { color:'#38bdf8', glow:'rgba(56,189,248,0.2)',   subtle:'rgba(56,189,248,0.06)'   },
  { color:'#a78bfa', glow:'rgba(167,139,250,0.2)',  subtle:'rgba(167,139,250,0.06)'  },
  { color:'#f472b6', glow:'rgba(244,114,182,0.2)',  subtle:'rgba(244,114,182,0.06)'  },
  { color:'#34d399', glow:'rgba(52,211,153,0.2)',   subtle:'rgba(52,211,153,0.06)'   },
  { color:'#fbbf24', glow:'rgba(251,191,36,0.2)',   subtle:'rgba(251,191,36,0.06)'   },
];

// Loading messages that rotate during API calls to keep users engaged
const LOADING_MSGS = [
  'mapping hidden connections…',
  'traversing knowledge wormholes…',
  'untangling the web of facts…',
  'colliding distant ideas…',
  'unearthing buried connections…',
];

/**
 * GLOBAL STATE MANAGEMENT
 * 
 * Central state object that tracks all application data and UI state.
 * This is the single source of truth for the entire application.
 */
const state = {
  mode: 'explore',           // Current interaction mode: 'explore' or 'bridge'
  nodes: new Map(),         // All knowledge nodes in the graph (Map<id, node>)
  edges: new Map(),         // All connections between nodes (Map<id, edge>)
  physics: {                // Physics simulation state
    running: false,         // Whether physics is currently running
    raf: null,             // RequestAnimationFrame ID
    ticks: 0               // Number of physics ticks elapsed
  },
  pan: {                    // Pan/offset state for world navigation
    active: false,          // Whether user is currently panning
    startX: 0, startY: 0,  // Mouse position when pan started
    offsetX: 0, offsetY: 0  // Current world offset in pixels
  },
  zoom: 1,                 // Current zoom level (1 = 100%)
  viewport: {               // Browser viewport dimensions
    w: window.innerWidth,   
    h: window.innerHeight
  },
  rootNodeId: null,        // ID of the root/central node
  focusedNodeId: null,      // ID of currently keyboard-focused node
};
// Counter to cycle through node colors
let nodeColorCounter = 0;

/**
 * DOM ELEMENT REFERENCES
 * 
 * Cached references to frequently accessed DOM elements for performance.
 * Using a querySelector wrapper for concise element access.
 */
const $ = s => document.querySelector(s);
const DOM = {
  body:          document.body,
  cursorRing:    $('#cursor-ring'),           // Custom cursor ring
  starfield:     $('#starfield'),             // Background canvas
  screenLanding: $('#screen-landing'),        // Landing screen
  screenGalaxy:  $('#screen-galaxy'),         // Galaxy/knowledge graph screen
  modeIndicator: $('.mode-indicator'),       // Animated mode switch indicator
  panelExplore:  $('#panel-explore'),         // Explore mode input panel
  panelBridge:   $('#panel-bridge'),          // Bridge mode input panel
  inpExplore:    $('#inp-explore'),           // Explore mode text input
  inpFrom:       $('#inp-from'),              // Bridge mode start input
  inpTo:         $('#inp-to'),                // Bridge mode destination input
  btnBack:       $('#btn-back'),              // Return to landing button
  btnReset:      $('#btn-reset'),             // Reset zoom/pan button
  svgEdges:      $('#svg-edges'),             // SVG for connection lines
  svgDots:       $('#svg-dots'),              // SVG for animated pulse dots
  nodesLayer:    $('#nodes-layer'),           // Container for node elements
  world:         $('#world'),                 // Main world container
  galaxyLoading: $('#galaxy-loading'),        // Loading indicator
  glStatus:      $('#gl-status'),             // Loading status text
  galaxyTopic:   $('#galaxy-topic-label'),    // Current topic display
  galaxyBadge:   $('#galaxy-mode-badge'),      // Current mode badge
};

/* ══════════════════════════════════════════
   CURSOR
══════════════════════════════════════════ */
const Cursor = (() => {
  let mx=-100, my=-100, rx=-100, ry=-100;
  function tick() {
    rx += (mx-rx)*0.13; ry += (my-ry)*0.13;
    DOM.cursorRing.style.left = rx+'px';
    DOM.cursorRing.style.top  = ry+'px';
    requestAnimationFrame(tick);
  }
  function init() {
    document.addEventListener('mousemove', e => { mx=e.clientX; my=e.clientY; });
    document.addEventListener('mouseover', e => {
      if (e.target.closest('button,a,.hint-tag,.node-expand-btn')) DOM.body.classList.add('cursor-hover');
    });
    document.addEventListener('mouseout', e => {
      if (e.target.closest('button,a,.hint-tag,.node-expand-btn')) DOM.body.classList.remove('cursor-hover');
    });
    tick();
  }
  return { init };
})();

/* ══════════════════════════════════════════
   STARFIELD
══════════════════════════════════════════ */
const Starfield = (() => {
  let ctx, stars=[], mouseX=0, mouseY=0;
  function initStars() {
    const W=state.viewport.w, H=state.viewport.h; stars=[];
    for(let i=0;i<350;i++) stars.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*0.5+0.1,baseAlpha:Math.random()*0.18+0.05,alpha:0,ts:Math.random()*0.005+0.001,tp:Math.random()*Math.PI*2,layer:0});
    for(let i=0;i<120;i++) stars.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.1+0.3,baseAlpha:Math.random()*0.3+0.12,alpha:0,ts:Math.random()*0.008+0.003,tp:Math.random()*Math.PI*2,layer:1});
    for(let i=0;i<40;i++)  stars.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.8+0.6,baseAlpha:Math.random()*0.4+0.3,alpha:0,ts:Math.random()*0.012+0.006,tp:Math.random()*Math.PI*2,layer:2,glow:true});
  }
 function draw() {
    const W=ctx.canvas.width, H=ctx.canvas.height;
    ctx.clearRect(0,0,W,H);
    const bg=ctx.createRadialGradient(W*0.5,H*0.42,0,W*0.5,H*0.42,Math.max(W,H)*1.2);
    bg.addColorStop(0,'#00091f'); bg.addColorStop(0.15,'#00050f'); bg.addColorStop(0.4,'#010008'); bg.addColorStop(0.7,'#000005'); bg.addColorStop(1,'#000000');
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
    const off=[{x:mouseX*-0.004,y:mouseY*-0.004},{x:mouseX*-0.014,y:mouseY*-0.014},{x:mouseX*-0.034,y:mouseY*-0.034}];
    for(const s of stars) {
      s.tp+=s.ts; s.alpha=s.baseAlpha*(0.55+0.45*Math.sin(s.tp));
      const o=off[s.layer], sx=s.x+o.x, sy=s.y+o.y;
      if(s.glow){const g=ctx.createRadialGradient(sx,sy,0,sx,sy,s.r*5);g.addColorStop(0,`rgba(180,215,255,${s.alpha})`);g.addColorStop(0.3,`rgba(150,195,255,${s.alpha*0.22})`);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.beginPath();ctx.arc(sx,sy,s.r*5,0,Math.PI*2);ctx.fill();}
      ctx.beginPath();ctx.arc(sx,sy,s.r,0,Math.PI*2);
      const b=s.layer===0?120:s.layer===1?160:210;
      ctx.fillStyle=`rgba(${b},${b+15},255,${s.alpha})`;ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  function init() {
    DOM.starfield.width=state.viewport.w; DOM.starfield.height=state.viewport.h;
    ctx=DOM.starfield.getContext('2d'); initStars();
    document.addEventListener('mousemove',e=>{mouseX=e.clientX-state.viewport.w/2;mouseY=e.clientY-state.viewport.h/2;});
    window.addEventListener('resize',()=>{state.viewport.w=window.innerWidth;state.viewport.h=window.innerHeight;DOM.starfield.width=state.viewport.w;DOM.starfield.height=state.viewport.h;initStars();WorldView.resize();});
    requestAnimationFrame(draw);
  }
  return { init };
})();

/* ══════════════════════════════════════════
   WORLD VIEW
══════════════════════════════════════════ */
const WorldView = (() => {
  function applyTransform() {
    DOM.world.style.transform = `translate(${state.pan.offsetX}px,${state.pan.offsetY}px) scale(${state.zoom})`;
  }

  function zoomAt(screenX, screenY, factor) {
    const newZoom = Math.max(0.25, Math.min(4, state.zoom * factor));
    const ratio   = newZoom / state.zoom;
    const dx = screenX - state.viewport.w/2;
    const dy = screenY - state.viewport.h/2;
    state.pan.offsetX = dx - ratio*(dx - state.pan.offsetX);
    state.pan.offsetY = dy - ratio*(dy - state.pan.offsetY);
    state.zoom = newZoom;
    applyTransform();
  }

  function resetTransform() {
    state.pan.offsetX = 0; state.pan.offsetY = 0; state.zoom = 1;
    applyTransform();
  }

  function resize() {
    DOM.svgEdges.setAttribute('viewBox', `0 0 ${state.viewport.w} ${state.viewport.h}`);
    Render.update();
  }

  function zoomToNode(node, targetZoom = 1.0) {
    if (!node) return;
    const targetX = -node.x * targetZoom;
    const targetY = -node.y * targetZoom;
    const startZoom = state.zoom, startX = state.pan.offsetX, startY = state.pan.offsetY;
    const duration = 750, startTime = performance.now();
    function step(now) {
      const t = Math.min((now - startTime) / duration, 1);
      const e = 1 - Math.pow(1 - t, 4);
      state.zoom        = startZoom + (targetZoom - startZoom) * e;
      state.pan.offsetX = startX    + (targetX    - startX)    * e;
      state.pan.offsetY = startY    + (targetY    - startY)    * e;
      applyTransform();
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function init() {
    DOM.svgEdges.setAttribute('viewBox', `0 0 ${state.viewport.w} ${state.viewport.h}`);
    applyTransform();

    DOM.screenGalaxy.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.10 : 0.91;
      zoomAt(e.clientX, e.clientY, factor);
    }, { passive: false });

    // Pan with zoom-scaled speed: more zoomed in = more movement per drag
    let dragStartX=0, dragStartY=0, dragStartPanX=0, dragStartPanY=0;
    DOM.screenGalaxy.addEventListener('mousedown', e => {
      if (e.target.closest('.knowledge-node,#galaxy-controls')) return;
      state.pan.active = true;
      dragStartX = e.clientX; dragStartY = e.clientY;
      dragStartPanX = state.pan.offsetX; dragStartPanY = state.pan.offsetY;
    });
    document.addEventListener('mousemove', e => {
      if (!state.pan.active) return;
      // Speed scales with zoom: at zoom=2 you pan 2x faster; clamp min at 0.6
      const speed = Math.max(0.6, state.zoom * 0.9);
      state.pan.offsetX = dragStartPanX + (e.clientX - dragStartX) * speed;
      state.pan.offsetY = dragStartPanY + (e.clientY - dragStartY) * speed;
      applyTransform();
    });
    document.addEventListener('mouseup', () => { state.pan.active = false; });

    // Touch
    let lastPinchDist = 0;
    let tStartX=0, tStartY=0, tStartPanX=0, tStartPanY=0;
    DOM.screenGalaxy.addEventListener('touchstart', e => {
      e.preventDefault();
      if (e.touches.length === 2) {
        const dx=e.touches[0].clientX-e.touches[1].clientX, dy=e.touches[0].clientY-e.touches[1].clientY;
        lastPinchDist = Math.sqrt(dx*dx+dy*dy); state.pan.active = false;
      } else if (e.touches.length === 1) {
        state.pan.active = true;
        tStartX=e.touches[0].clientX; tStartY=e.touches[0].clientY;
        tStartPanX=state.pan.offsetX; tStartPanY=state.pan.offsetY;
      }
    }, { passive:false });
    DOM.screenGalaxy.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length === 2) {
        const dx=e.touches[0].clientX-e.touches[1].clientX, dy=e.touches[0].clientY-e.touches[1].clientY;
        const dist=Math.sqrt(dx*dx+dy*dy);
        const midX=(e.touches[0].clientX+e.touches[1].clientX)/2, midY=(e.touches[0].clientY+e.touches[1].clientY)/2;
        if (lastPinchDist>0) zoomAt(midX, midY, dist/lastPinchDist);
        lastPinchDist=dist;
      } else if (e.touches.length===1 && state.pan.active) {
        const speed = Math.max(0.6, state.zoom * 0.9);
        state.pan.offsetX = tStartPanX + (e.touches[0].clientX - tStartX) * speed;
        state.pan.offsetY = tStartPanY + (e.touches[0].clientY - tStartY) * speed;
        applyTransform();
      }
    }, { passive:false });
    DOM.screenGalaxy.addEventListener('touchend', e => {
      if (e.touches.length<2) lastPinchDist=0;
      if (e.touches.length===0) state.pan.active=false;
    });
  }

  return { init, applyTransform, zoomAt, resetTransform, zoomToNode, resize };
})();

/* ══════════════════════════════════════════
   PHYSICS
══════════════════════════════════════════ */
const Physics = (() => {
  const cfg = { repulsion:90000, springK:0.018, springLen:360, centerPull:0.00004, damping:0.82, maxV:14, maxR:2400 };

  function tick() {
    const nodes = Array.from(state.nodes.values());
    if (nodes.length < 2) { stop(); return; }
    let maxKE = 0;
    for (const n of nodes) {
      if (n.fixed) continue;
      let fx=0, fy=0;
      fx -= n.x * cfg.centerPull; fy -= n.y * cfg.centerPull;
      for (const m of nodes) {
        if (m.id===n.id) continue;
        const dx=n.x-m.x, dy=n.y-m.y, d2=dx*dx+dy*dy+1, d=Math.sqrt(d2);
        fx+=(dx/d)*cfg.repulsion/d2; fy+=(dy/d)*cfg.repulsion/d2;
      }
      for (const e of state.edges.values()) {
        const oid=e.fromId===n.id?e.toId:(e.toId===n.id?e.fromId:null);
        if (!oid) continue;
        const o=state.nodes.get(oid); if (!o) continue;
        const dx=o.x-n.x, dy=o.y-n.y, d=Math.sqrt(dx*dx+dy*dy)+1;
        const f=cfg.springK*(d-cfg.springLen);
        fx+=(dx/d)*f; fy+=(dy/d)*f;
      }
      n.vx=Math.max(-cfg.maxV,Math.min(cfg.maxV,(n.vx+fx)*cfg.damping));
      n.vy=Math.max(-cfg.maxV,Math.min(cfg.maxV,(n.vy+fy)*cfg.damping));
      n.x+=n.vx; n.y+=n.vy;
      const dist=Math.sqrt(n.x*n.x+n.y*n.y);
      if (dist>cfg.maxR){const ov=dist-cfg.maxR;n.x-=(n.x/dist)*ov*0.3;n.y-=(n.y/dist)*ov*0.3;n.vx*=0.45;n.vy*=0.45;}
      maxKE=Math.max(maxKE,n.vx*n.vx+n.vy*n.vy);
    }
    state.physics.ticks++;
    if (maxKE<0.003 && state.physics.ticks>200) stop();
    else state.physics.raf=requestAnimationFrame(tick);
  }
  function stop()  { state.physics.running=false; if(state.physics.raf) cancelAnimationFrame(state.physics.raf); }
  function start() { if(state.physics.running)return; state.physics.running=true; state.physics.ticks=0; state.physics.raf=requestAnimationFrame(tick); }
  function kick()  { stop(); state.physics.ticks=0; state.physics.running=true; state.physics.raf=requestAnimationFrame(tick); }
  return { start, stop, kick };
})();

/* ══════════════════════════════════════════
   RENDER
══════════════════════════════════════════ */
const Render = (() => {
  const WC = () => state.viewport.w / 2;
  const HC = () => state.viewport.h / 2;

  // Measure actual card size in world-space CSS pixels (offsetWidth = pre-transform)
  function getCardSize(node) {
    if (!node.el) return { hw:150, hh:80 };
    const card = node.el.querySelector('.node-card');
    if (!card || !card.offsetWidth) return { hw:150, hh:80 };
    return { hw: card.offsetWidth / 2, hh: card.offsetHeight / 2 };
  }

  function cardEdgePt(cx, cy, dx, dy, hw, hh) {
    if (dx===0 && dy===0) return {x:cx, y:cy};
    const len=Math.sqrt(dx*dx+dy*dy), nx=dx/len, ny=dy/len;
    const tx=nx!==0?hw/Math.abs(nx):Infinity;
    const ty=ny!==0?hh/Math.abs(ny):Infinity;
    const t=Math.min(tx,ty);
    return { x:cx+nx*t, y:cy+ny*t };
  }

  function updateNodePosition(node) {
    if (!node.el) return;
    node.el.style.left = (WC() + node.x) + 'px';
    node.el.style.top  = (HC() + node.y) + 'px';
  }

  function updateEdge(edge) {
    if (!edge.el) return;
    const from=state.nodes.get(edge.fromId), to=state.nodes.get(edge.toId);
    if (!from||!to) return;

    const x1=WC()+from.x, y1=HC()+from.y;
    const x2=WC()+to.x,   y2=HC()+to.y;
    const dx=x2-x1, dy=y2-y1;

    const s1=getCardSize(from), s2=getCardSize(to);
    const p1=cardEdgePt(x1,y1, dx, dy, s1.hw, s1.hh);
    const p2=cardEdgePt(x2,y2,-dx,-dy, s2.hw, s2.hh);

    const dPath=`M${p1.x},${p1.y} L${p2.x},${p2.y}`;
    edge.el.setAttribute('d', dPath);
    if (edge.glowEl)  edge.glowEl.setAttribute('d', dPath);
    if (edge.glowEl2) edge.glowEl2.setAttribute('d', dPath);
    if (edge.glowEl3) edge.glowEl3.setAttribute('d', dPath);
  }

  function update() {
    for (const n of state.nodes.values()) updateNodePosition(n);
    for (const e of state.edges.values()) updateEdge(e);
  }

  return { update, updateNodePosition, updateEdge };
})();

/* ══════════════════════════════════════════
   NODE MANAGER
══════════════════════════════════════════ */
const NodeMgr = (() => {
  let idCounter = 0;
  function nextColor() { const c=NODE_COLORS[nodeColorCounter%NODE_COLORS.length]; nodeColorCounter++; return c; }

  function create({ topic, fact, link='', x=0, y=0, depth=0, isRoot=false, fixed=false, isBridge=false }) {
    const id  = `n${++idCounter}`;
    const col = nextColor();
    const el  = document.createElement('div');
    el.className = `knowledge-node depth-${Math.min(depth,3)}`;
    el.id = `node-${id}`; el.dataset.id = id;
    el.style.setProperty('--nc', col.color);
    el.style.setProperty('--ng', col.glow);
    el.style.setProperty('--ns', col.subtle);

    el.innerHTML = `
      <div class="node-card">
        <div class="node-card-header">
          <div class="node-card-topic">${escHtml(topic)}</div>
        </div>
        <div class="node-card-fact">${escHtml(truncateFact(fact))}</div>
        <div class="node-card-actions">
          <button class="node-expand-btn" data-id="${id}">+ 3 more</button>
        </div>
      </div>`;

    if (isRoot) el.classList.add('is-root');
    el.classList.add('spawning');
    setTimeout(() => el.classList.remove('spawning'), 700);

    DOM.nodesLayer.appendChild(el);
    const node = { id, topic, fact, link, x, y, vx:0, vy:0, depth, fixed, el, color:col, expanded:false, parentId:null, isRoot, isBridge };
    state.nodes.set(id, node);
    Render.updateNodePosition(node);

    // Add expand button listener
    el.querySelector('.node-expand-btn').addEventListener('click', e => {
      e.stopPropagation(); App.expandNode(id);
    });

    // Hide expand button for root node and bridge nodes
    if (isRoot || isBridge) {
      const expandBtn = el.querySelector('.node-expand-btn');
      if (expandBtn) expandBtn.style.display = 'none';
    }

    // Click to focus/select
    el.addEventListener('click', () => { KeyNav.focusNode(id); });

    return node;
  }

  function clear() {
    DOM.nodesLayer.innerHTML = '';
    DOM.svgEdges.querySelectorAll('.edge-group').forEach(e => e.remove());
    DOM.svgDots.innerHTML = '';
    state.nodes.clear(); state.edges.clear();
    nodeColorCounter = 0; idCounter = 0;
    state.focusedNodeId = null;
  }

  return { create, clear };
})();

/* ══════════════════════════════════════════
   EDGE MANAGER
══════════════════════════════════════════ */
const EdgeMgr = (() => {
  let idCounter = 0;

  function create({ fromId, toId }) {
    const id   = `e${++idCounter}`;
    const from = state.nodes.get(fromId);
    const to   = state.nodes.get(toId);
    if (!from||!to) return null;

    // Track parent relationship on child node
    const toNode = state.nodes.get(toId);
    if (toNode) toNode.parentId = fromId;

    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.classList.add('edge-group');

    const glowPath3 = document.createElementNS('http://www.w3.org/2000/svg','path');
    glowPath3.classList.add('edge-glow-3');
    const glowPath2 = document.createElementNS('http://www.w3.org/2000/svg','path');
    glowPath2.classList.add('edge-glow-2');
    const glowPath = document.createElementNS('http://www.w3.org/2000/svg','path');
    glowPath.classList.add('edge-glow');
    glowPath.style.filter = 'none';

    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.classList.add('edge-path');
    path.id = `ep-${id}`;

    // Traveling pulse dot with pause between cycles
    const pulseDot = document.createElementNS('http://www.w3.org/2000/svg','circle');
    pulseDot.classList.add('edge-pulse-dot');
    pulseDot.setAttribute('r','2.5');

    const totalDur = (2.0 + Math.random()*1.8).toFixed(2);
    const travelFrac = 0.72;

    const animMotion = document.createElementNS('http://www.w3.org/2000/svg','animateMotion');
    animMotion.setAttribute('dur', `${totalDur}s`);
    animMotion.setAttribute('repeatCount','indefinite');
    animMotion.setAttribute('calcMode','linear');
    animMotion.setAttribute('keyPoints', `0;1;1`);
    animMotion.setAttribute('keyTimes', `0;${travelFrac};1`);
    const mpath = document.createElementNS('http://www.w3.org/2000/svg','mpath');
    mpath.setAttributeNS('http://www.w3.org/1999/xlink','href',`#ep-${id}`);
    animMotion.appendChild(mpath);

    const animOpacity = document.createElementNS('http://www.w3.org/2000/svg','animate');
    animOpacity.setAttribute('attributeName', 'opacity');
    animOpacity.setAttribute('dur', `${totalDur}s`);
    animOpacity.setAttribute('repeatCount', 'indefinite');
    animOpacity.setAttribute('calcMode', 'discrete');
    animOpacity.setAttribute('keyTimes', `0;${travelFrac};1`);
    animOpacity.setAttribute('values', `1;0;0`);

    pulseDot.appendChild(animMotion);
    pulseDot.appendChild(animOpacity);

    g.appendChild(glowPath3);
    g.appendChild(glowPath2);
    g.appendChild(glowPath);
    g.appendChild(path);
    DOM.svgEdges.appendChild(g);
    DOM.svgDots.appendChild(pulseDot);

    const edge = { id, fromId, toId, el:path, glowEl:glowPath, glowEl2:glowPath2, glowEl3:glowPath3, groupEl:g };
    state.edges.set(id, edge);
    Render.updateEdge(edge);
    return edge;
  }
  return { create };
})();

/* ══════════════════════════════════════════
   KEYBOARD NAVIGATION — spatial (direction-based)
══════════════════════════════════════════ */
const KeyNav = (() => {
  function focusNode(nodeId) {
    if (state.focusedNodeId) {
      const prev = state.nodes.get(state.focusedNodeId);
      if (prev && prev.el) prev.el.classList.remove('keyboard-focus');
    }
    state.focusedNodeId = nodeId;
    const node = state.nodes.get(nodeId);
    if (!node || !node.el) return;
    node.el.classList.add('keyboard-focus');
    // Zoom in closer so the focused card is comfortably readable
    WorldView.zoomToNode(node, 1.6);
  }

  function navigate(dir) {
    if (!state.focusedNodeId) {
      if (state.rootNodeId) focusNode(state.rootNodeId);
      return;
    }
    const current = state.nodes.get(state.focusedNodeId);
    if (!current) return;

    // Cardinal direction vectors
    const vectors = {
      right: { x:  1, y:  0 },
      left:  { x: -1, y:  0 },
      down:  { x:  0, y:  1 },
      up:    { x:  0, y: -1 },
    };
    const dv = vectors[dir];
    if (!dv) return;

    let bestId = null, bestScore = -Infinity;
    for (const [id, node] of state.nodes) {
      if (id === state.focusedNodeId) continue;
      const dx = node.x - current.x;
      const dy = node.y - current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;
      // Dot product of (normalised offset) with desired direction
      const dot = (dx / dist) * dv.x + (dy / dist) * dv.y;
      // Only accept nodes within ~65° of the desired direction (dot > cos65° ≈ 0.42)
      if (dot < 0.32) continue;
      // Score: strongly favour alignment, mildly penalise distance
      const score = dot * dot / dist;
      if (score > bestScore) { bestScore = score; bestId = id; }
    }
    if (bestId) focusNode(bestId);
  }

  function init() {
    document.addEventListener('keydown', e => {
      if (!DOM.screenGalaxy.classList.contains('active')) return;
      if (e.target.tagName === 'INPUT') return;

      switch (e.key) {
        case 'ArrowUp':    case 'w': case 'W': e.preventDefault(); navigate('up');    break;
        case 'ArrowDown':  case 's': case 'S': e.preventDefault(); navigate('down');  break;
        case 'ArrowLeft':  case 'a': case 'A': e.preventDefault(); navigate('left');  break;
        case 'ArrowRight': case 'd': case 'D': e.preventDefault(); navigate('right'); break;
      }
    });
  }

  return { init, focusNode, navigate };
})();

/* ══════════════════════════════════════════
   PERSISTENT RENDER LOOP
   Edges always track card borders every frame.
══════════════════════════════════════════ */
const RenderLoop = (() => {
  function tick() { Render.update(); requestAnimationFrame(tick); }
  function init()  { requestAnimationFrame(tick); }
  return { init };
})();

/* ══════════════════════════════════════════
   LAYOUT — WEDGE-BASED RADIAL TREE

   Every node owns an angular wedge.
   Children subdivide their parent's wedge
   equally — overlap is impossible by design.
   Nodes are placed at: depth × RADIAL_GAP px
   from origin, at the midpoint of their wedge.
══════════════════════════════════════════ */

const RADIAL_GAP = 420;  // px between depth levels
const MIN_WEDGE  = 0.48; // min radians per child (~27°) keeps cards readable

function outwardAngle(node) {
  const len = Math.sqrt(node.x * node.x + node.y * node.y);
  if (len < 1) return -Math.PI / 2;
  return Math.atan2(node.y, node.x);
}

/**
 * Compute positions for `count` children of `parentNode`.
 * parentNode must have .angleMin and .angleMax set.
 * Returns [{x, y, angleMin, angleMax}, …]
 */
function layoutChildren(parentNode, count) {
  if (count === 0) return [];

  const depth  = (parentNode.depth || 0) + 1;
  const pMin   = parentNode.angleMin ?? -Math.PI;
  const pMax   = parentNode.angleMax ??  Math.PI;
  const arcLen = pMax - pMin;

  // Give each child an equal slice; enforce MIN_WEDGE
  const wedge  = Math.max(arcLen / count, MIN_WEDGE);
  const used   = wedge * count;
  // Centre children within parent's arc
  const start  = (pMin + pMax) / 2 - used / 2;

  // Push radius out if wedges got enlarged beyond parent's arc
  const minRadius = (used / (2 * Math.PI)) * RADIAL_GAP * 2 * Math.PI / used;
  const radius = Math.max(depth * RADIAL_GAP, minRadius);

  return Array.from({ length: count }, (_, i) => {
    const cMin  = start + i * wedge;
    const cMax  = cMin + wedge;
    const angle = (cMin + cMax) / 2;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, angleMin: cMin, angleMax: cMax };
  });
}

function layoutBridgePath(count) {
  const W = Math.max((count-1)*420, Math.min(state.viewport.w * 0.85, 1400));
  const positions = [];
  for (let i=0; i<count; i++) {
    const t = count>1 ? i/(count-1) : 0.5;
    const x = -W/2 + t*W;
    const y = (i%2===0 ? -1 : 1) * 150;
    positions.push({ x, y });
  }
  return positions;
}

/* ══════════════════════════════════════════
   TOAST + LOADING
══════════════════════════════════════════ */
function toast(msg, type='') {
  let c=document.getElementById('toast-container');
  if (!c){c=document.createElement('div');c.id='toast-container';document.body.appendChild(c);}
  const t=document.createElement('div');
  t.className=`toast ${type}`; t.textContent=msg; c.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),400);},3000);
}
function showLoading(msg) {
  DOM.glStatus.textContent=msg||LOADING_MSGS[Math.floor(Math.random()*LOADING_MSGS.length)];
  DOM.galaxyLoading.classList.remove('hidden'); DOM.galaxyLoading.style.opacity='1';
}
function hideLoading() {
  DOM.galaxyLoading.style.opacity='0';
  setTimeout(()=>DOM.galaxyLoading.classList.add('hidden'),400);
}

/* ── UTIL ── */
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function delay(ms) { return new Promise(r=>setTimeout(r,ms)); }

/** Hard-clamp a fact string to at most 2 sentences. */
function truncateFact(text) {
  if (!text) return '';
  // Split on sentence-ending punctuation followed by a space or end-of-string
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  return sentences.slice(0, 2).join('').trim();
}

/* ══════════════════════════════════════════
   APP CONTROLLER
══════════════════════════════════════════ */
const App = {
  async init() {
    Cursor.init();
    Starfield.init();
    WorldView.init();
    RenderLoop.init();
    KeyNav.init();
    this.bindLanding();
    this.bindGalaxy();
    DOM.panelBridge.classList.remove('active');
  },

  bindLanding() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchMode(btn.dataset.mode));
    });
    DOM.inpExplore.addEventListener('keydown', e => {
      if (e.key === 'Enter' && DOM.inpExplore.value.trim()) this.startExplore();
    });

    DOM.inpFrom.addEventListener('keydown', e => { if (e.key === 'Enter') DOM.inpTo.focus(); });
    DOM.inpTo.addEventListener('keydown', e => {
      if (e.key === 'Enter' && DOM.inpFrom.value.trim() && DOM.inpTo.value.trim()) this.startBridge();
    });

    document.querySelectorAll('.hint-tag:not(.bridge-hint)').forEach(tag => {
      tag.addEventListener('click', () => {
        DOM.inpExplore.value = tag.dataset.val;
        DOM.inpExplore.focus();
      });
    });

    document.querySelectorAll('.bridge-hint').forEach(tag => {
      tag.addEventListener('click', () => {
        DOM.inpFrom.value = tag.dataset.from;
        DOM.inpTo.value   = tag.dataset.to;
        DOM.inpTo.focus();
      });
    });
  },

  bindGalaxy() {
    DOM.btnBack.addEventListener('click', () => this.returnToLanding());
    DOM.btnReset.addEventListener('click', () => {
      if (state.rootNodeId) {
        const root = state.nodes.get(state.rootNodeId);
        if (root) { WorldView.zoomToNode(root, 1.15); return; }
      }
      WorldView.resetTransform();
    });
  },

  switchMode(mode) {
    if (state.mode === mode) return;
    state.mode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode===mode);
      btn.setAttribute('aria-selected', btn.dataset.mode===mode);
    });
    DOM.modeIndicator.classList.toggle('right', mode==='bridge');
    const show = mode==='explore' ? DOM.panelExplore : DOM.panelBridge;
    const hide = mode==='explore' ? DOM.panelBridge  : DOM.panelExplore;
    hide.classList.remove('active');
    setTimeout(() => {
      show.classList.add('active');
      if (mode==='explore') DOM.inpExplore.focus();
      else DOM.inpFrom.focus();
    }, 180);
  },

  goToGalaxy(label, modeTag) {
    DOM.galaxyTopic.textContent = label;
    DOM.galaxyBadge.textContent = modeTag;
    DOM.galaxyBadge.className   = modeTag.toLowerCase();
    DOM.screenLanding.classList.add('exit');
    setTimeout(() => {
      DOM.screenLanding.classList.remove('active','exit');
      DOM.screenGalaxy.classList.add('active');
      WorldView.resetTransform();
    }, 500);
  },

  returnToLanding() {
    Physics.stop(); NodeMgr.clear();
    DOM.screenGalaxy.classList.remove('active','bridge-mode');
    setTimeout(() => {
      DOM.screenLanding.classList.add('active');
      DOM.inpExplore.value=''; DOM.inpFrom.value=''; DOM.inpTo.value='';
    }, 100);
  },

  /* ── EXPLORE ── */
  async startExplore() {
    const topic = DOM.inpExplore.value.trim(); if (!topic) return;
    nodeColorCounter = 0;
    this.goToGalaxy(topic, 'explore');
    await delay(500); showLoading();
    try {
      const data = await groqExplore(topic);
      NodeMgr.clear();

      // Root owns the full circle
      const root = NodeMgr.create({ topic, fact: data.centerFact || topic, x: 0, y: 0, depth: 0, isRoot: true, fixed: true });
      state.rootNodeId = root.id;
      hideLoading();
      WorldView.zoomToNode(root, 0.85);

      await delay(160);
      const count = data.branches.length;
      for (let i = 0; i < count; i++) {
        const b = data.branches[i];
        await delay(i * 120);
        // Hint position: evenly spaced around root, physics will refine
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const r = 420;
        const node = NodeMgr.create({
          topic: b.topic, fact: b.fact, link: b.link,
          x: Math.cos(angle) * r, y: Math.sin(angle) * r,
          depth: 1, fixed: false
        });
        EdgeMgr.create({ fromId: root.id, toId: node.id });
      }

      Physics.kick();
      KeyNav.focusNode(root.id);

    } catch(err) { hideLoading(); toast('Error: ' + err.message, 'error'); console.error(err); }
  },


  /* ── EXPAND ── */
  async expandNode(nodeId) {
    const node = state.nodes.get(nodeId);
    if (!node || node.expanded) return;
    node.expanded = true;

    const btn = node.el.querySelector('.node-expand-btn');
    btn.disabled = true; btn.classList.add('loading'); btn.textContent = '…';

    showLoading(`expanding ${node.topic}…`);
    try {
      const data = await groqExpand(node.topic);
      hideLoading();

      const expandCount = data.branches.length;
      const baseAngle = outwardAngle(node);
      const spread = Math.PI * 0.7;

      for (let i = 0; i < expandCount; i++) {
        const b = data.branches[i];
        await delay(i * 140);
        // Hint: fan out in the direction away from parent
        const angle = baseAngle - spread / 2 + (spread / Math.max(expandCount - 1, 1)) * i;
        const r = Math.sqrt(node.x * node.x + node.y * node.y) + 380;
        const newNode = NodeMgr.create({
          topic: b.topic, fact: b.fact, link: b.link,
          x: node.x + Math.cos(angle) * 380,
          y: node.y + Math.sin(angle) * 380,
          depth: node.depth + 1, fixed: false
        });
        EdgeMgr.create({ fromId: node.id, toId: newNode.id });
      }

      Physics.kick();
      btn.classList.remove('loading'); btn.textContent = '✓ done';

    } catch(err) {
      hideLoading(); node.expanded = false; btn.disabled = false;
      btn.classList.remove('loading'); btn.textContent = '+ 3 more';
      toast('Expansion failed: ' + err.message, 'error');
    }
  },

  /* ── BRIDGE ── */
  async startBridge() {
    const from = DOM.inpFrom.value.trim(), to = DOM.inpTo.value.trim();
    if (!from||!to) return;
    nodeColorCounter = 0;
    this.goToGalaxy(`${from} → ${to}`, 'bridge');
    DOM.screenGalaxy.classList.add('bridge-mode');
    await delay(500); showLoading('charting the hidden path…');
    try {
      const data = await groqBridge(from, to);
      const path = data.path || [];
      if (path.length<2) throw new Error('Path too short');
      NodeMgr.clear(); hideLoading();

      const positions = layoutBridgePath(path.length);
      const nodeIds   = [];

      for (let i=0; i<path.length; i++) {
        const p=path[i], isEnd=(i===0||i===path.length-1);
        const node = NodeMgr.create({
          topic:p.topic, fact:p.fact,
          x:positions[i].x, y:positions[i].y,
          depth:isEnd?0:1, fixed:true, isBridge:true
        });
        if (isEnd) node.el.classList.add('is-root');
        nodeIds.push(node.id);
      }
      state.rootNodeId = nodeIds[0];

      // Connect edges one by one for visual effect
      for (let i=0;i<nodeIds.length-1;i++) {
        await delay(80);
        EdgeMgr.create({ fromId:nodeIds[i], toId:nodeIds[i+1] });
      }

      Render.update();

      // Zoom to the FIRST (start) card, same as explore
      const startNode = state.nodes.get(nodeIds[0]);
      if (startNode) WorldView.zoomToNode(startNode, 1.15);

      // Focus first card for keyboard nav
      KeyNav.focusNode(nodeIds[0]);
      // NO Physics — bridge stays static

    } catch(err) { hideLoading(); toast('Bridge failed: '+err.message,'error'); console.error(err); }
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());