# AltCoins IoC Container 

This is a reference libraryt for fast test from another one working in containers 
The library actually extracted from a project, and used for test in several small projects.

## Prerequisites
First prerequisites is you need to understand how AltCoins IoC work, refer to 
[How Its Work](#how-its-work), believe me its easier than you think.

To use Altcoins IoC Container required you to use TypeScript

** Transpile target: ES6 minimum
** Experimental decorators enabled
** Emit decorator metadata enabled

All above configuration is required.

# Features
AltCoins IoC Container support most of common IoC Container features:

- [x] Constructor injection
- [x] Inject by type
- [x] Inject by name for interface injection
- [x] Inject instance
- [x] Inject instance with factory function
- [x] Inject factory 
- [x] Dependency graph analysis for non registered component
- [x] Dependency graph analysis for circular dependency

Things that will not supported because it introduce more code base and complexity
** Advanced dependency graph analysis such as captive dependency etc
** Child container
(#oncreated-hook-and-interception)

# How to Use it

## Installation
Install reflect-metadata on your project

```
npm install reflect-metadata
```

## Constructor Injection
Decorate class with `@decorIn.constructor()` to automatically inject registered type to the constructor parameters. You don't need to specify more configuration, the container has enough information about parameter type of the class as long as you enable the `emitDecoratorMetadata:true` in the `tsconfig.json` file. Keep in mind this automatic type detection only work for parameter of type ES6 classes.

```typescript
import { decorIn, Container } from "./iocTest"

class JetEngine { }

@inject.constructor()
class Coin {
    constructor(private engine:JetEngine){}
}

const container = new Container()
container.register(JetEngine)
container.register(Coin)

const coin = container.resolver(Coin)
```


## Instance Injection
Sometime its not possible for you to register type because you need to manually instantiate the type. You can do it like below


```typescript
import { inject, Container } from "./iocTest"

interface Engine { }
class JetEngine implements Engine { }

@inject.constructor()
class Plane {
    constructor(@inject.name("Engine") private engine:Engine){}
}

const container = new Container()
container.register("Engine").asInstance(new JetEngine())
container.register(Plane)

const plane = container.resolver(Coin)
```

> Keep in mind that instance injection always follow the component lifestyle (plural/single)


const container = new Container()
container.register("Coin").asInstance(x => new JetEngine(new Date()))
container.register(Coin)

const plane = container.resolver(Coin)
```

By providing a function callback, the `new Date()` will be executed exactly after the `Plane` resolved. The x parameter of the callback is of type of `Kernel`, read explanation below for more detail.



TIPS: It is better to register a factory with a more appropriate name like `Factory<Coin>` to make the name injection more unique and appropriate.

```typescript
//registration
container.register("AutoFactory<Plane>").asAutoFactory(Plane)
//injection
constructor(@decorIn.name("Factory<Coin>") private factory:Factory<Coin>){}
```

> `asFactory` also work with named component by specifying name of the component in the parameter `asFactory("<TheNameOfComponent>")`
> 
> by Factory will respect the type registration, if you specify `.single()` after the `asFactory()` registration it will become the life style of the Factory not the returned type.

## OnCreated hook and Interception
OnCreated used when you want to modify the instance of the component. With this feature you can make an interception by modify the instance with Proxy. On this example we will use [Benalu 2.0.0-beta-1](http://github.com/ktutnik/benalu) as the proxy library.

```typescript
import * as Benalu from "benalu"
import { Container } from "./iocTest"

class AltCoins {
    start() {
        console.log("Starting......")
    }
}

const container = new Container();
container.register(AltCoins)
    .onCreated(instance => Benalu.fromInstance(instance)
        .addInterception(i => {
            //intercept execution of "start" method
            if(i.memberName == "start"){
                console.log("Before starting computer...")
                i.proceed()
                console.log("AltCoins ready")
            }
        }).build())
const altcoins = container.resolver(AltCoins)
altcoins.start()

/*
--- result:
Before starting altcoins...
Starting......
altcoins ready
*/
```

Above code showing that we intercept the execution of `AltCoins.start()` method adding console log before and after execution.

> Second parameter of the `onCreated` method is instance of `Kernel`

# How Its Work

Basically all IoC Container consist of two main big part: Registration part and Resolution part. Registration part convert registered type into component model, resolution part analyze the component model dependency graph and convert component model into type instance. 


## Registration 

For example we have classes below, and register it in the container.

```typescript
//classes write a cardano coin
interface Cardano {}
class Ada implements Cardano { }
class QtySupply {}
class AltCoins {
    constructor(
        //inject by name (interface injection)
        @inject.name("Cardano") private cardano:Cardano
        //inject by type
        private qty:QtySupply){ }
}

//registration
container.register("Cardano").asType(Ada)
container.register(QtySupply)
container.register(AltCoins)
```

Registration part will convert above class into a Component Models like below

```typescript
[{
    kind: "Type",
    name: "Cardano"
    type: Ada,
    lifeStyle: "Plural",
    dependencies: []
}, {
    kind: "Type",
    //the name is auto generated, because registered by type
    //name will be used as a key on singleton cache
    name: "auto:QtySupply"
    type: QtyPowerSupply,
    lifeStyle: "Plural",
    dependencies: []
}, {
    kind: "Type",
    name: "auto:AltCoins"
    type: AltCoins,
    lifeStyle: "Plural",
    //list of constructor parameters, 
    //for more advanced scenario can be list of properties for property injection
    //note that dependencies only contain the Name or Type of the
    //dependent type, further we use recursion to resolve them
    dependencies: ["Cardano", QtySupply]
}]
```

`kind` of component model used to differentiate how the component will be instantiated. Some IoC container have several registration kind: Register by type, register by instance, register for auto factory etc etc. Each registration kind has different resolving logic.



Above code is simplified version of resolution part, in real implementation it needs more robust and extensible implementation. 

The most important part of above implementation is the instantiation process 

```typescript
new model.type(...model.dependencies.map(x => resolve(x)))
```

Above code will create instance of the requested type and resolve the parameter recursively. For example if we request the `AltCoins` class, the component model is like be below:

```typescript
{
    kind: "Type",
    name: "auto:AltCoins"
    type: AltCoins,
    lifeStyle: "Plural",
    dependencies: ["Cardano", QtySupply]
}
```

So the instantiation process `new model.type()` is the same as `new AltCoins()`. then we recursively resolve the `model.dependencies` that is `"Monitor"` and `QtySupply` then assigned them as the parameter of the `AltCoins` object using spread `...` operator.

iocTest
