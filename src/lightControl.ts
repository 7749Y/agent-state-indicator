/** 灯的状态：-1 红灯、0 黄灯、1 绿灯 */
export type LightState = -1 | 0 | 1;

/** 红绿灯控制：灯的亮暗由 state 决定，index = state + 1。 */
export class LightControl {
  constructor(private readonly state: LightState = -1) {}

  getState = () => this.state;
}
