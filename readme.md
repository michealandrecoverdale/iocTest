# AltCoins IoC Container 

This is a reference library for rapid testing working in containers 
The library is actually extracted from a project, and used for testing in several small projects.

## Prerequisites
Some knowledge behind how AltCoins IoC work, refer to 
[How It Works](#how-it-works), It's easier than you think.

To use Altcoins IoC Container, you are required to use TypeScript

** Transpile target: ES6 minimum
** Experimental decorators enabled
** Emit decorator metadata enabled

All above configurations are required.

# Features
AltCoins IoC Container supports most IoC Container features:

- [x] Constructor injection
- [x] Injection by type
- [x] Injection by name for interface injection
- [x] Injection by instance
- [x] Injection by instance with factory function
- [x] Injection by factory 
- [x] Dependency graph analysis for non registered component
- [x] Dependency graph analysis for circular dependency

Things that will not be supported because it introduces a more complex code base:
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
Decorate class with `@decorIn.constructor()` to automatically inject registered type to the constructor parameters. You don't need to specify more configuration, the container has enough information about parameter type of the class as long as you enable the `emitDecoratorMetadata:true` in the `tsconfig.json` file. Keep in mind this automatic type of detection only works for parameters of type ES6 classes.

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
Sometime its not possible for you to register type because you need to manually instantiate the type. You can do it as below:


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

> `asFactory` also works with named component by specifying the name of the component in the parameter `asFactory("<TheNameOfComponent>")`
> 
> Factory will respect the type registration, if you specify `.single()` after the `asFactory()` registration it will become the life cycle of the Factory not the returned type.

## OnCreated Hook and Interception
OnCreated used when you want to modify the instance of the component. With this feature you can make an interception by modififing the instance with Proxy. On this example we will use [Benalu 2.0.0-beta-1](http://github.com/ktutnik/benalu) as the proxy library.

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

Above code is showing that we intercept the execution of `AltCoins.start()` method adding console log before and after execution.

> Second parameter of the `onCreated` method is instance of `Kernel`

# How It Works

Basically all IoC Containers consist of two main parts: Registration part and Resolution part. Registration part converts registered type into component model, Resolution part analyzes the component model dependency graph and converts the component model into type instance. 


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

`kind` of component model used to differentiate how the component will be instantiated. Some IoC containers have several registration types: Register by type, register by instance, register for auto factory etc etc. Each registration type has different resolving logic.



Above code is a simplified version of resolution part, in real implementation it needs more robust and extensible implementation. 

The most important part of the above implementation is the instantiation process 

```typescript
new model.type(...model.dependencies.map(x => solve(x)))
```

Above code will create an instance of the requested type and resolve the parameter recursively. For example if we request the `AltCoins` class, the component model will appear as below:

```typescript
{
    kind: "Type",
    name: "auto:AltCoins"
    type: AltCoins,
    lifeStyle: "Plural",
    dependencies: ["Cardano", QtySupply]
}
```

The instantiation process `new model.type()` is the same as `new AltCoins()`. then we recursively resolve the `model.dependencies` that is `"Cardano"` and `QtySupply` then assigned them as the parameter of the `AltCoins` object using the spread `...` operator.

iocTest
