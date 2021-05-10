export class Crosshairs {
  constructor() {
    const map = new THREE.TextureLoader().load("../../images/crosshairs.png");
    const material = new THREE.SpriteMaterial({ map: map });
    this.sprite = new THREE.Sprite(material);
    this.sprite.scale.set(0.2, 0.2, 1);
    this.sprite.visible = false;
  }

  setTo = (pos) => {
    this.sprite.visible = true;
    this.sprite.position.copy(pos);
  };
}
