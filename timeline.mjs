export const START_DATE='2026-05-13';
export const TARGET_DATE='2026-11-28';
export const DAYS_PER_SECOND=3;
const DAY_MS=86400000;
const startTime=Date.parse(`${START_DATE}T00:00:00Z`);
export const GOAL_DAYS=(Date.parse(`${TARGET_DATE}T00:00:00Z`)-startTime)/DAY_MS;
export const GOAL_SECONDS=GOAL_DAYS/DAYS_PER_SECOND;

export function gameDate(elapsed){
  const time=Number.isNaN(elapsed)?0:Math.max(0,elapsed??0);
  const days=Math.floor(Math.min(GOAL_DAYS,time*DAYS_PER_SECOND));
  const date=new Date(startTime+days*DAY_MS);
  return `${date.getUTCMonth()+1}月${date.getUTCDate()}日`;
}
