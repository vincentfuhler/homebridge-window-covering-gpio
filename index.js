var request = require("request");
var Service, Characteristic;
var inherits = require('util').inherits;
var rpio = require('rpio');

var allCoverings = {};

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic; 
  homebridge.registerAccessory("window-covering-gpio", "WindowCoveringGPIO", WindowCoveringGPIOAccessory);
}

function WindowCoveringGPIOAccessory(log, config) {

  this.log = log;
  this.name = config["name"];
  this.upGPIO = config["up-gpio"];
  this.downGPIO = config["down-gpio"];
  this.valueMapping = config['valueMapping'];
  this.mode = Characteristic.PositionState.STOPPED;
  this.openTime = config["open-Time"] 	  	 	|| 63.0;;
  this.closeTime = config["close-Time"] 	  	 	|| 63.0;;
  this.current = 100;
  this.target = 100;
  this.counter = 0;
  this.angle = -90;

  this.service = new Service.WindowCovering(this.name);
  this.service.setCharacteristic(Characteristic.TargetPosition, this.target);
  this.service.setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.STOPPED);
  this.service.addCharacteristic(this.makeDirectSelectCharacteristic())
  .on('set', this.setDirectSelect.bind(this));

  this.service
  .getCharacteristic(Characteristic.CurrentPosition)
  .on('get', this.getState.bind(this));

  this.service
  .getCharacteristic(Characteristic.TargetPosition)
  .on('set', this.setState.bind(this));

  this.service
  .getCharacteristic(Characteristic.TargetHorizontalTiltAngle)
  .on('set', this.setAngle.bind(this));

  rpio.open(this.upGPIO, rpio.OUTPUT, 1);
  rpio.open(this.downGPIO, rpio.OUTPUT, 1);
}

WindowCoveringGPIOAccessory.prototype.setCurrentMode = function(mode){
  if (this.mode == mode) {
    // Nothing to do here.
  } else {
    var oldMode = this.mode;
    if (mode == Characteristic.PositionState.STOPPED){
      this.log("new Mode STOPPED");   
      this.counter++;
      if (oldMode == Characteristic.PositionState.INCREASING ){
        if (this.target < 90 ) {
          // This is a Stp Signal.
          this.sendSignalOpen('stopUp');
          this.mode = mode;
          this.service.setCharacteristic(Characteristic.PositionState, mode);         
          return
        }
        if (this.current == 100) {
          this.sendSignalOpen('stopUp100');
          this.mode = mode;
          this.service.setCharacteristic(Characteristic.PositionState, mode);
          return
        }
      }
      if (oldMode == Characteristic.PositionState.DECREASING){
        if (this.target > 10 ) {
          // This is a Stop Signal
          this.sendSignalOpen('stopDown');
          this.mode = mode;
          this.service.setCharacteristic(Characteristic.PositionState, mode);
          return
        }
        if (this.current == 0) {
          this.sendSignalOpen('stopDown100');
          this.mode = mode;
          this.service.setCharacteristic(Characteristic.PositionState, mode);
          return
        }
      }
      if(this.counter > 50){
        this.mode = mode;
        this.service.setCharacteristic(Characteristic.PositionState, mode);
      }
      this.checkPositionStateAfterTimeout();
      return;
    }
    this.mode = mode;
    this.counter = 0;
    if (this.mode == Characteristic.PositionState.INCREASING){
      if (oldMode == Characteristic.PositionState.DECREASING){
        // Double Send for first Stopping.
        var THIS = this;
        setTimeout(function(){ THIS.sendSignalOpen('up'); } , 3000);
      }
      this.sendSignalOpen('up');
      this.log("new Mode INCREASING.");
      this.service.setCharacteristic(Characteristic.TargetHorizontalTiltAngle, -90);

    }
    if (this.mode == Characteristic.PositionState.DECREASING){
      if (oldMode == Characteristic.PositionState.INCREASING){
        // Double Send for first Stopping.
        var THIS = this;
        setTimeout(function(){ THIS.sendSignalOpen('down'); } , 3000);
      }
      this.sendSignalOpen('down');
      this.log("new Mode DECREASING.");
      this.service.setCharacteristic(Characteristic.TargetHorizontalTiltAngle, 90);
    }
    this.service.setCharacteristic(Characteristic.PositionState, mode);
    this.checkPositionStateAfterTimeout();
  }
}
WindowCoveringGPIOAccessory.prototype.setCurrentPosition = function(position){
  var positionInInterval = position;
  if (position > 100){
    positionInInterval = 100;
  }
  if (position < 0){
    positionInInterval = 0;
  }
  this.service.setCharacteristic(Characteristic.CurrentPosition, positionInInterval);
  this.current = positionInInterval;
  this.log("New Position:" + positionInInterval.toString());
}
WindowCoveringGPIOAccessory.prototype.sendSignalOpen = function(job) {

if (job == 'up'){
  this.log("Will Send on up");
  rpio.write(this.downGPIO, 1);
  rpio.write(this.upGPIO, 0);
} else if (job == 'down'){
  this.log("Will Send on down");
  rpio.write(this.upGPIO, 1);
  rpio.write(this.downGPIO, 0);

}else if (job == 'stopDown'){
  this.log("Will Send on stopDown");
  rpio.write(this.downGPIO, 1);
  rpio.write(this.upGPIO, 0);
  setTimeout(()=>rpio.write(this.upGPIO, 1), 500);
  

}else if (job == 'stopUp'){
  this.log("Will Send on stopUp");
  rpio.write(this.upGPIO, 1);
  rpio.write(this.downGPIO, 0);
  setTimeout(()=>rpio.write(this.downGPIO, 1), 500);
  
}else if (job == 'stopDown100'){
  this.log("Will Send on stopDown100");
  rpio.write(this.downGPIO, 1);
  
}else if (job == 'stopUp100'){
  this.log("Will Send on stopUp100");
  rpio.write(this.upGPIO, 1);
  
}

}

WindowCoveringGPIOAccessory.prototype.checkPositionState = function() {
  if (this.mode == Characteristic.PositionState.STOPPED){
    return;
  }

  if (this.mode == Characteristic.PositionState.INCREASING){
    this.setCurrentPosition( this.current + (100.0/this.openTime));
    if( this.current >=  this.target ) {
      this.setCurrentMode(Characteristic.PositionState.STOPPED);
    }
  }

  if (this.mode == Characteristic.PositionState.DECREASING){
    this.setCurrentPosition(this.current - (100.0/this.closeTime));
    if( this.current <=  this.target) {
      this.setCurrentMode(Characteristic.PositionState.STOPPED);
    }
  }
  this.checkPositionStateAfterTimeout();

}
WindowCoveringGPIOAccessory.prototype.checkPositionStateAfterTimeout = function() {
  var THIS = this;
  setTimeout(function(){
      THIS.checkPositionState();
  }, 1000);
}
WindowCoveringGPIOAccessory.prototype.makeDirectSelectCharacteristic = function(name) {
  var values = [];
  for (var sendingString in this.valueMapping){
    values.push(sendingString);
  }
  var nameObject  = {"name" : "directSelect", "values" : values}
  var generated = function() {
    Characteristic.call(this,JSON.stringify(nameObject), '00001002-0000-1C12-8ABC-135D67EC4377');
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.WRITE]
    });
    this.value = "";
  };
  inherits(generated, Characteristic);
  return generated;
},


WindowCoveringGPIOAccessory.prototype.setDirectSelect = function (stringValue, callback) {
   var value = -1;
   if (typeof stringValue == 'undefined') {
     callback(new Error("No String Defiend"));
     return;
   }
   for (var sendingString in this.valueMapping) {
     if (sendingString.toUpperCase() == stringValue.toUpperCase()) {
       value = this.valueMapping[sendingString];
     }
   }
  if (value == -1) {
    callback(new Error("Error . Unknown Value"));
  } else {
    this.service
    .setCharacteristic(Characteristic.TargetPosition, value);
    this.setState(value,callback);
  }
}

WindowCoveringGPIOAccessory.prototype.getState = function(callback) {
  this.service.setCharacteristic(Characteristic.CurrentPosition, this.current);
  callback(null,this.current);
}

WindowCoveringGPIOAccessory.prototype.setState = function(state, callback) {
  this.log("Setting new Taret Position" + state.toString());
  this.target = state;
  // ToleranceValue will only be Applied to States between 10% and 90%
  if (state > 10 && state < 90){
    var toleranceValue = (state-this.current)*(state-this.current);
    if ( toleranceValue < 101) {
      this.log("Will not Change because in tolerance");
      callback(null);
      return;
    }
  }

  if (state > this.current || state > 90) {
    this.setCurrentMode(Characteristic.PositionState.INCREASING);
  }
  if (state < this.current || state < 10) {
    this.setCurrentMode(Characteristic.PositionState.DECREASING);
  }
  setTimeout(function(){
    callback(null);
  }, 500);


}
WindowCoveringGPIOAccessory.prototype.setAngle = function(angle, callback) {
  this.log("Setting new Taret Angle" + angle.toString());
  this.angle = angle;






  setTimeout(function(){
    callback(null);
  }, 500);
}

WindowCoveringGPIOAccessory.prototype.getServices = function() {
  return [this.service];
}