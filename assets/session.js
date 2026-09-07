export const SESSION_IDLE_MS=15*60*1000;

export class SessionGuard {
  constructor(onExpire,{timeout=SESSION_IDLE_MS,now=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout}={}) {
    this.onExpire=onExpire;this.timeout=timeout;this.now=now;this.setTimer=setTimer;this.clearTimer=clearTimer;
    this.active=false;this.lastActivity=0;this.timer=null;
  }
  start() {this.stop();this.active=true;this.lastActivity=this.now();this.schedule();}
  touch() {
    if(!this.active)return false;
    if(this.now()-this.lastActivity>=this.timeout){this.expire();return false;}
    this.lastActivity=this.now();this.schedule();return true;
  }
  check() {
    if(!this.active)return false;
    if(this.now()-this.lastActivity>=this.timeout){this.expire();return false;}
    this.schedule();return true;
  }
  schedule() {
    if(this.timer!==null)this.clearTimer(this.timer);
    this.timer=this.setTimer(()=>this.check(),Math.max(0,this.timeout-(this.now()-this.lastActivity)));
  }
  expire() {this.stop();this.onExpire();}
  stop() {if(this.timer!==null)this.clearTimer(this.timer);this.timer=null;this.active=false;this.lastActivity=0;}
}
