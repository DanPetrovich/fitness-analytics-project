const DATA = window.FITNESS_DATA;
const COLORS = {
  "Разминка":"#ef725d", "Кардио":"#287cc1", "Силовая":"#6ab6d8",
  "Йога":"#67a956", "Дэнс":"#8e72c7", "Интенсив":"#f3a62d"
};
const TYPES = Object.keys(COLORS);
const TRAINER_INITIALS = {"Анна":"А","Богдана":"Б","Виталия":"В","Галина":"Г","Диана":"Д"};
const state = {period:"all", week:null, type:null, trainer:null, workout:null};
const $ = s => document.querySelector(s);
const fmt = new Intl.NumberFormat("ru-RU");
const pct = v => `${(v*100).toFixed(1).replace(".",",")}%`;
const tooltip = $("#tooltip");

function filtered(exclude){
  const [lo,hi] = state.period === "1-5" ? [1,5] : state.period === "6-10" ? [6,10] : [1,10];
  return DATA.workouts.filter(d => d.week>=lo && d.week<=hi)
    .filter(d => exclude==="week" || !state.week || d.week===state.week)
    .filter(d => exclude==="type" || !state.type || d.type===state.type)
    .filter(d => exclude==="trainer" || !state.trainer || d.trainer===state.trainer)
    .filter(d => exclude==="workout" || !state.workout || d.code===state.workout);
}
function sum(a,f){return a.reduce((s,d)=>s+f(d),0)}
function weighted(a,value,weight){const den=sum(a,weight);return den?sum(a,d=>value(d)*weight(d))/den:0}
function group(a,key){return a.reduce((m,d)=>((m[d[key]]??=[]).push(d),m),{})}
function svgEl(name,attrs={}){const n=document.createElementNS("http://www.w3.org/2000/svg",name);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));return n}
function text(svg,x,y,value,cls="axis-text",anchor="start"){const n=svgEl("text",{x,y,class:cls,"text-anchor":anchor});n.textContent=value;svg.append(n);return n}
function showTip(event,html){tooltip.innerHTML=html;tooltip.classList.add("show");moveTip(event)}
function moveTip(event){tooltip.style.left=`${Math.min(event.clientX+10,innerWidth-260)}px`;tooltip.style.top=`${Math.min(event.clientY+10,innerHeight-160)}px`}
function hideTip(){tooltip.classList.remove("show")}
function toggle(key,value){state[key]=state[key]===value?null:value;if(key!=="workout")state.workout=null;render()}
function bindTip(node,html){node.addEventListener("mouseenter",e=>showTip(e,typeof html==="function"?html():html));node.addEventListener("mousemove",moveTip);node.addEventListener("mouseleave",hideTip)}

function renderControls(){
  document.querySelectorAll("[data-period]").forEach(b=>b.classList.toggle("active",b.dataset.period===state.period));
  const bits=[]; if(state.period!=="all")bits.push(`недели ${state.period}`);if(state.week)bits.push(`неделя ${state.week}`);if(state.type)bits.push(state.type);if(state.trainer)bits.push(`тренер ${state.trainer}`);if(state.workout)bits.push(state.workout);
  $("#selectionText").textContent=bits.length?`Фильтр: ${bits.join(" · ")}`:"Все данные";
  $("#resetFilters").disabled=!bits.length&&state.period==="all";
}
function renderKpis(){
  const a=filtered(); const weeks=[...new Set(a.map(d=>d.week))].sort((x,y)=>x-y);
  const first=sum(a.filter(d=>d.week===weeks[0]),d=>d.views), last=sum(a.filter(d=>d.week===weeks.at(-1)),d=>d.views);
  const change=first?(last/first-1):0;
  const items=[
    ["Просмотры",fmt.format(sum(a,d=>d.views)),"суммарно по выбранным тренировкам"],
    ["Тренировки",fmt.format(new Set(a.map(d=>d.code)).size),"в текущей выборке"],
    ["Изменение",`${change>=0?"+":""}${Math.round(change*100)}%`,weeks.length>1?`с ${weeks[0]}-й по ${weeks.at(-1)}-ю неделю`:"выбрана одна неделя",change<0?"negative":""],
    ["Глубина",pct(weighted(a,d=>d.depth,d=>d.views)),"средняя по просмотрам"],
    ["Оценка",weighted(a,d=>d.rating||0,d=>d.ratings).toFixed(2),`${fmt.format(sum(a,d=>d.ratings))} оценок`]
  ];
  $("#kpis").innerHTML=items.map(([l,v,n,c])=>`<article class="kpi"><div class="kpi-label">${l}</div><div class="kpi-value">${v}</div><div class="kpi-note ${c||""}">${n}</div></article>`).join("");
}
function renderLegend(){
  $("#typeLegend").innerHTML=TYPES.map(t=>`<button data-type="${t}" class="${state.type&&state.type!==t?"dim":""}"><i style="background:${COLORS[t]}"></i>${t}</button>`).join("");
  document.querySelectorAll("#typeLegend button").forEach(b=>b.onclick=()=>toggle("type",b.dataset.type));
}
function renderWeekly(){
  const root=$("#weeklyChart"), data=filtered("week"), byWeek=group(data,"week"),[lo,hi]=state.period==="1-5"?[1,5]:state.period==="6-10"?[6,10]:[1,10],weeks=Array.from({length:hi-lo+1},(_,i)=>lo+i),activeWeeks=weeks.filter(w=>(byWeek[w]||[]).length);
  if(!activeWeeks.length){root.innerHTML='<div class="empty">Нет данных для этого фильтра</div>';return}
  const W=1040,H=470,m={l:58,r:24,t:24,b:52},iw=W-m.l-m.r,ih=H-m.t-m.b;
  const totals=weeks.map(w=>sum(byWeek[w]||[],d=>d.views)), max=Math.max(100,Math.ceil(Math.max(...totals)/100)*100);
  const x=w=>m.l+(weeks.indexOf(w)+.5)*iw/weeks.length, bw=Math.min(64,iw/weeks.length*.58), y=v=>m.t+ih-v/max*ih;
  const svg=svgEl("svg",{viewBox:`0 0 ${W} ${H}`,"aria-hidden":"true"});
  for(let i=0;i<=4;i++){const v=max*i/4,yy=y(v);svg.append(svgEl("line",{x1:m.l,y1:yy,x2:W-m.r,y2:yy,class:"grid-line"}));text(svg,m.l-10,yy+4,fmt.format(v),"axis-text","end")}
  weeks.forEach(w=>{let acc=0;(byWeek[w]||[]).sort((a,b)=>TYPES.indexOf(a.type)-TYPES.indexOf(b.type)).forEach(d=>{const h=d.views/max*ih,top=y(acc+d.views);const r=svgEl("rect",{x:x(w)-bw/2,y:top,width:bw,height:Math.max(2,h),fill:COLORS[d.type],opacity:Math.max(.46,Math.min(1,d.depth)),class:"clickable"});if(state.workout===d.code)r.classList.add("selected-stroke");r.onclick=()=>toggle("workout",d.code);bindTip(r,`<b>${d.code}</b><br>${d.type} · ${d.trainer}<br>Неделя ${d.week}<br><b>${d.views}</b> просмотров<br>Глубина ${pct(d.depth)} · оценка ${d.rating?.toFixed(2)??"н/д"}`);svg.append(r);if(h>13)text(svg,x(w),top+h/2+3,TRAINER_INITIALS[d.trainer]||"", "trainer-initial","middle");acc+=d.views});const weekLabel=text(svg,x(w),H-26,String(w),state.week===w?"axis-label clickable":"axis-text clickable","middle");weekLabel.onclick=()=>toggle("week",w)});
  const points=activeWeeks.map(w=>`${x(w)},${y(sum(byWeek[w],d=>d.views))}`).join(" ");if(activeWeeks.length>1)svg.append(svgEl("polyline",{points,fill:"none",stroke:"#17231f","stroke-width":3,"stroke-linejoin":"round"}));activeWeeks.forEach(w=>svg.append(svgEl("circle",{cx:x(w),cy:y(sum(byWeek[w],d=>d.views)),r:4,fill:"#fff",stroke:"#17231f","stroke-width":2})));
  text(svg,W/2,H-5,"Неделя","axis-label","middle");const yl=text(svg,15,H/2,"Количество просмотров","axis-label","middle");yl.setAttribute("transform",`rotate(-90 15 ${H/2})`);root.replaceChildren(svg);
}
function renderTypes(){
  const root=$("#typeChart"),groups=group(filtered("type"),"type"),rows=TYPES.map(t=>({type:t,views:sum(groups[t]||[],d=>d.views)})).filter(d=>d.views).sort((a,b)=>b.views-a.views),max=Math.max(...rows.map(d=>d.views),1);
  root.innerHTML=rows.map(d=>`<div class="bar-row ${state.type&&state.type!==d.type?"dim":""}" data-type="${d.type}"><div class="bar-label">${d.type}</div><div class="bar-track"><div class="bar-fill" style="width:${d.views/max*100}%;background:${COLORS[d.type]}"></div></div><div class="bar-value">${fmt.format(d.views)}</div></div>`).join("");root.querySelectorAll(".bar-row").forEach(r=>r.onclick=()=>toggle("type",r.dataset.type));
}
function renderTrainers(){
  const root=$("#trainerChart"),a=filtered(),trainers=Object.keys(TRAINER_INITIALS),cells=[];trainers.forEach(trainer=>TYPES.forEach(type=>{const items=a.filter(d=>d.trainer===trainer&&d.type===type);if(items.length)cells.push({trainer,type,items,avg:sum(items,d=>d.views)/items.length,depth:weighted(items,d=>d.depth,d=>d.views),rating:weighted(items,d=>d.rating||0,d=>d.ratings)})}));const max=Math.max(...cells.map(d=>d.avg),1);
  let html='<div class="trainer-matrix"><div></div>'+TYPES.map(t=>`<div class="matrix-head">${t}</div>`).join("");trainers.forEach(trainer=>{html+=`<div class="matrix-trainer ${state.trainer&&state.trainer!==trainer?"dim":""}" data-trainer="${trainer}">${trainer}</div>`;TYPES.forEach(type=>{const d=cells.find(c=>c.trainer===trainer&&c.type===type);if(!d){html+='<div class="matrix-cell empty-cell">—</div>';return}const alpha=.22+.78*d.avg/max;html+=`<div class="matrix-cell ${state.trainer&&state.trainer!==trainer||state.type&&state.type!==type?"dim":""}" data-trainer="${trainer}" data-type="${type}" style="background:rgba(24,95,76,${alpha.toFixed(2)})"><b>${d.avg.toFixed(1)}</b><small>${pct(d.depth)} · ${d.rating.toFixed(2)}</small></div>`});});html+='</div>';root.innerHTML=html;root.querySelectorAll(".matrix-trainer").forEach(n=>n.onclick=()=>toggle("trainer",n.dataset.trainer));root.querySelectorAll(".matrix-cell[data-trainer]").forEach(n=>{n.onclick=()=>{const selected=state.trainer===n.dataset.trainer&&state.type===n.dataset.type;state.trainer=selected?null:n.dataset.trainer;state.type=selected?null:n.dataset.type;state.workout=null;render()};bindTip(n,()=>{const d=cells.find(c=>c.trainer===n.dataset.trainer&&c.type===n.dataset.type);return `<b>${d.trainer} × ${d.type}</b><br>${d.items.length} видео<br>${d.avg.toFixed(1)} просмотра на видео<br>Глубина ${pct(d.depth)}<br>Оценка ${d.rating.toFixed(2)}`})});
}
function renderScatter(){
  const root=$("#scatterChart"),base=filtered("workout"),a=state.workout?base.filter(d=>d.code===state.workout):base;if(!a.length){root.innerHTML='<div class="empty">Нет данных</div>';return}
  const W=520,H=330,m={l:48,r:18,t:16,b:42},iw=W-m.l-m.r,ih=H-m.t-m.b;const minX=Math.min(.75,...base.map(d=>d.depth))-.015,maxX=1.01,minY=Math.min(2.5,...base.filter(d=>d.rating).map(d=>d.rating))-.1,maxY=5.05;
  const x=v=>m.l+(v-minX)/(maxX-minX)*iw,y=v=>m.t+ih-(v-minY)/(maxY-minY)*ih;const svg=svgEl("svg",{viewBox:`0 0 ${W} ${H}`});
  for(let i=0;i<=4;i++){const v=minY+(maxY-minY)*i/4,yy=y(v);svg.append(svgEl("line",{x1:m.l,y1:yy,x2:W-m.r,y2:yy,class:"grid-line"}));text(svg,m.l-8,yy+4,v.toFixed(1),"axis-text","end")}
  [.8,.85,.9,.95,1].filter(v=>v>=minX).forEach(v=>{svg.append(svgEl("line",{x1:x(v),y1:m.t,x2:x(v),y2:H-m.b,class:"grid-line"}));text(svg,x(v),H-20,`${Math.round(v*100)}%`,"axis-text","middle")});
  const risky=[...a].filter(d=>d.rating).sort((d,e)=>(d.depth+d.rating/5)-(e.depth+e.rating/5)).slice(0,5);a.filter(d=>d.rating).forEach(d=>{const radius=4+Math.sqrt(d.views)*.65;const c=svgEl("circle",{cx:x(d.depth),cy:y(d.rating),r:state.workout===d.code?Math.max(9,radius):radius,fill:COLORS[d.type],opacity:.82,stroke:d.rating<4.4?"#18201d":"#fff","stroke-width":d.rating<4.4?2.5:1,class:"clickable"});if(state.workout===d.code)c.classList.add("selected-stroke");c.onclick=()=>toggle("workout",d.code);bindTip(c,`<b>Видео ${d.code}</b><br>${d.type} · ${d.trainer}<br>${d.views} просмотров<br>Глубина ${pct(d.depth)}<br>Оценка ${d.rating.toFixed(2)} (${d.ratings})`);svg.append(c);if(risky.includes(d))text(svg,x(d.depth)+radius+2,y(d.rating)-radius,d.code,"scatter-label")});
  root.replaceChildren(svg);
}
function renderCohorts(){
  const root=$("#cohortChart"),[lo,hi]=state.period==="1-5"?[1,5]:state.period==="6-10"?[6,10]:[1,10];let rows=DATA.cohortType.filter(d=>d.week>=lo&&d.week<=hi).filter(d=>!state.week||d.week===state.week).filter(d=>!state.type||d.type===state.type).filter(d=>!state.trainer||d.trainer===state.trainer);
  const cohorts=["Низкая","Средняя","Высокая"],g=group(rows,"cohort");root.innerHTML=cohorts.map(c=>{const tg=group(g[c]||[],"type"),total=sum(g[c]||[],d=>d.views);const spans=TYPES.map(t=>{const v=sum(tg[t]||[],d=>d.views);return v?`<span data-type="${t}" style="width:${v/total*100}%;background:${COLORS[t]}" title="${t}: ${pct(v/total)}"></span>`:""}).join("");return `<div class="cohort-row"><div class="cohort-label"><span>${c} активность</span><span>${fmt.format(total)} пр.</span></div><div class="stack">${spans}</div><div class="stack-legend">${DATA.meta.cohortSizes[c]} зрителей</div></div>`}).join("");root.querySelectorAll("[data-type]").forEach(s=>s.onclick=()=>toggle("type",s.dataset.type));$("#cohortMethod").textContent=`Группы по числу тренировок пользователя: низкая активность — до ${DATA.meta.cohortCuts[0]}, средняя — ${DATA.meta.cohortCuts[0]+1}–${DATA.meta.cohortCuts[1]}, высокая — от ${DATA.meta.cohortCuts[1]+1}.`;
}
function render(){renderControls();renderKpis();renderLegend();renderWeekly();renderTrainers();renderScatter();renderCohorts()}
document.querySelectorAll("[data-period]").forEach(b=>b.onclick=()=>{state.period=b.dataset.period;state.week=null;state.workout=null;render()});
$("#resetFilters").onclick=()=>{Object.assign(state,{period:"all",week:null,type:null,trainer:null,workout:null});render()};
render();
