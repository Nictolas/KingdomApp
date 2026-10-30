/**
 * Second-generation procedural geography for the expandable 32x32 world.
 *
 * All natural features are functions of ABSOLUTE world coordinates. No random
 * draws depend on visit order, sector loading, frame time or device.
 * This is deliberately independent of the v1 generator: old saves can keep
 * their original terrain forever while new worlds get linked rivers/ridges.
 *
 * Biomes are computed at territory scale with continuous regional noise.
 * Rivers and mountain chains are computed in global tile coordinates, so the
 * same landmark crosses the edges of two adjacent territories.
 */
export type GeographicBiome = "pianura"|"foresta"|"collina"|"palude"|"arido";
export type GeographicGround = "grass"|"woodland"|"rock"|"water"|"dry";

function hash(n:number):number {
  n=Math.imul(n^(n>>>16),0x7feb352d);
  n=Math.imul(n^(n>>>15),0x846ca68b);
  return (n^(n>>>16))>>>0;
}
function fraction(seed:number,x:number,y:number,salt:number):number {
  return hash((seed>>>0)^Math.imul(x+103793,0x9e3779b1)^
    Math.imul(y+41731,0x85ebca77)^salt)/0x100000000;
}
function interpolate(a:number,b:number,t:number):number {
  const smooth=t*t*(3-2*t);
  return a+(b-a)*smooth;
}
function noise1D(seed:number,x:number,period:number,salt:number):number {
  const q=x/period,k=Math.floor(q),t=q-k;
  return interpolate(fraction(seed,k,0,salt),fraction(seed,k+1,0,salt),t);
}
function noise2D(seed:number,x:number,y:number,period:number,salt:number):number {
  const fx=x/period,fy=y/period;
  const ix=Math.floor(fx),iy=Math.floor(fy);
  const xx=fx-ix,yy=fy-iy;
  const top=interpolate(fraction(seed,ix,iy,salt),fraction(seed,ix+1,iy,salt),xx);
  const bottom=interpolate(fraction(seed,ix,iy+1,salt),fraction(seed,ix+1,iy+1,salt),xx);
  return interpolate(top,bottom,yy);
}

export function regionalBiome(seed:number,tx:number,ty:number):GeographicBiome {
  // 32 tiles per territory. Weather patterns form regions, not independent
  // random stamps at every boundary.
  const x=tx*32+16,y=ty*32+16;
  const moisture=noise2D(seed,x,y,180,0x41b20);
  const elevation=noise2D(seed,x,y,200,0x7ba10);
  const warmth=noise2D(seed,x,y,290,0x1c91);
  if(elevation>0.70)return "collina";
  if(moisture>0.67&&elevation<0.45)return "palude";
  if(moisture>0.59)return "foresta";
  if(moisture<0.31&&warmth>0.46)return "arido";
  if(elevation>0.59)return "collina";
  return "pianura";
}

export function riverAt(seed:number,gx:number,gy:number):boolean {
  // Across the entire world, a long, meandering river occurs roughly every
  // 176 tiles. The position depends only on global X, so BOTH sides of a
  // vertical territory boundary compute the same uninterrupted watercourse.
  const riverSpacing=176;
  const closestBand=Math.round((gy-38)/riverSpacing);
  for(let band=closestBand-1;band<=closestBand+1;band++){
    const base=band*riverSpacing+38;
    const curve=(noise1D(seed,gx,88,0x4ad5+band*47)-0.5)*42+
      (noise1D(seed,gx,23,0x312d+band*19)-0.5)*12;
    const center=base+curve;
    const width=1.7+fraction(seed,band,0,0x99a1)*1.3;
    if(Math.abs(gy-center)<=width)return true;
  }
  return false;
}

export function ridgeAt(seed:number,gx:number,gy:number):boolean {
  // Irregular near-vertical mountain belts. Use a separate axis from rivers,
  // and both long- and short-wave noise to avoid square-shaped mountains.
  const shifted=gx+gy*0.26;
  const nearestBand=Math.round((shifted-115)/245);
  for(let band=nearestBand-1;band<=nearestBand+1;band++){
    const center=band*245+115+
      (noise1D(seed,gy,92,0x22bb+band*31)-0.5)*65;
    const distance=Math.abs(shifted-center);
    const width=5+(noise1D(seed,gy,29,0x119a+band*73))*10;
    if(distance<width)return true;
  }
  return false;
}

export function naturalGeographyAt(
  seed:number,gx:number,gy:number,biome:GeographicBiome
):GeographicGround {
  if(riverAt(seed,gx,gy))return "water";
  if(ridgeAt(seed,gx,gy))return "rock";

  const canopy=noise2D(seed,gx,gy,17,0xa007);
  const canopyDetail=noise2D(seed,gx,gy,7,0xa01a);
  const wet=noise2D(seed,gx,gy,52,0x3502);
  const exposed=noise2D(seed,gx,gy,31,0x420d);
  const forestiness=canopy*0.73+canopyDetail*0.27;

  if(biome==="palude"&&wet>0.74&&exposed<0.50)return "water";
  if(biome==="foresta"&&forestiness>0.43)return "woodland";
  if(biome==="pianura"&&forestiness>0.76)return "woodland";
  if(biome==="collina"&&exposed>0.72)return "rock";
  if(biome==="palude"&&forestiness>0.70)return "woodland";
  if(biome==="arido")return exposed>0.77?"rock":"dry";
  return "grass";
}
