# homebridge-window-covering-gpio
Homebridge plugin to control window covering via gpio.
The position of the window covering is calculated based on the time. It is important that the "open-time" and "close-time" are entered correctly.
The angle is controlled using an open and close command.
## Example config
```json
{
    "bridge": {
      "name": "Homebridge",
      "username": "CC:22:3D:E3:CE:30",
      "port": 51826,
      "pin": "031-45-154"
    },
    "description": "This is an example configuration for the Homebridge Window Covering GPIO",
    "accessories": [
      {
        "accessory": "WindowCoveringGPIO",
        "name": "Window Covering",
        "up-gpio": 5, //use GPIO Numbers (GPIO5 is Hardware PIN 29 on RP 3)
        "down-gpio": 3,
        "valueMapping": ,
        "open-Time":2000, // time for full opening
        "close-Time":2000, // time for full closing
        "valueMapping": { // status mapping for homekit
            "closed": 0,
            "kind of closed": 30,
            "open": 100
        }
      }
    ]
  }

```