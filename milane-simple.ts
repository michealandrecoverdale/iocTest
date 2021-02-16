import "reflect-metadata";
import * as Benalu from "benalu";
import {
    Factory,
    AFModel,
    AbModel,
    Container,
    GraphAnalyzer,
    decorIn,
    InstanceAbModel,
    TypeModel,
    } from "../lib/src/milane";

describe("GraphAnalyzer", () => {
    it("Should identify alt coins components", () => {
        class AdaCoin { }
        @decorIn.constructor()
        class Cardano {
            constructor(moneda: AdaCoin) { }
        }
        class Litecoin { }
        class Ethereum { }
        class Ripple {}
        @decorIn.constructor()
        class AltCoins {
            constructor(cardano: Cardano, extensionCardano: Cardano, ltc: Litecoin, eth: Ethereum, xrp: Ripple) { }
        }

        const analyzer = new GraphAnalyzer([
            new TypeModel(Ripple),
            new TypeModel(Litecoin),
            new TypeModel(Ethereum),
            new TypeModel(AdaCoin),
            new TypeModel(Cardano),
            new TypeModel(AltCoins)
        ])
        expect(analyzer.analyze(AltCoins)).toBeUndefined()
    })

    it("Should OK with other type of component model than TypeModel", () => {
        
        class AdaCoin { }
        @decorIn.constructor()
        class Cardano {
            constructor(@decorIn.name("ADA") moneda: any) { }
        }
        @decorIn.constructor()
        class AltCoins {
            constructor(@decorIn.name("CardanoFactory") cardano: any) { }
        }

        const analyzer = new GraphAnalyzer([
            new InstanceAbModel(new AdaCoin(), "ADA"),
            new AFModel(Cardano, "Factory"),
            new TypeModel(AltCoins, "AltCoins")
        ])
        expect(analyzer.analyze(AltCoins)).toBeUndefined()

    })

    it("Should identify non registered component", () => {
        const analyzer = new GraphAnalyzer([])
        expect(() => analyzer.analyze("Component")).toThrow("Trying to resolve Component but Component is not registered in container")
    })

    it("Should identify non registered component in depth dependency", () => {
        class AdaCoin { }
        @decorIn.constructor()
        class Cardano {
            constructor(moneda: AdaCoin) { }
        }
        @decorIn.constructor()
        class AltCoins {
            constructor(cardano: Cardano) { }
        }

        const analyzer = new GraphAnalyzer([
            //AdaCoin not registered
            new TypeModel(Cardano),
            new TypeModel(AltCoins)
        ])
        expect(() => analyzer.analyze(AltCoins)).toThrow("Trying to resolve AltCoins -> Cardano -> AdaCoin but AdaCoin is not registered in container")
    })

    it("Should identify circular dependency", () => {
        @decorIn.constructor()
        class AdaCoin {
            constructor(@decorIn.name("AltCoins") altcoin: any) { }
        }
        @decorIn.constructor()
        class Cardano {
            constructor(moneda: AdaCoin) { }
        }
        @decorIn.constructor()
        class AltCoins {
            constructor(cardano: Cardano) { }
        }

        const analyzer = new GraphAnalyzer([
            new TypeModel(AdaCoin),
            new TypeModel(Cardano),
            new TypeModel(AltCoins, "AltCoins")
        ])
        expect(() => analyzer.analyze("AltCoins")).toThrow("Circular dependency detected on: AltCoins -> Cardano -> AdaCoin -> AltCoins")
    })

    it("Should skip analysis of already analyzed component", () => {
        class AdaCoin { }
        @decorIn.constructor()
        class Cardano {
            constructor(moneda: AdaCoin) { }
        }
        @decorIn.constructor()
        class AltCoins {
            constructor(cardano: Cardano, extensionCardano: Cardano) { }
        }

        const path: string[] = []
        const analyzer = new GraphAnalyzer([
            new TypeModel(AdaCoin),
            new TypeModel(Cardano),
            new TypeModel(AltCoins)
        ], p => path.push(p))
        analyzer.analyze(AltCoins)
        expect(path).toEqual([
            'AltCoins',
            //without cached analysis below path will be repeated twice
            'AltCoins -> Cardano',
            'AltCoins -> Cardano -> AdaCoin'
        ])
    })
})

describe("Container", () => {
    it("Should able resolve basic constructor decorInion", () => {
        class Trade { }
        class Litecoin { }
        class Cardano { }
        @decorIn.constructor()
        class AltCoins {
            constructor(public Trade: Trade, public litecoin: Litecoin, public cardano: Cardano) { }
        }
        const container = new Container();
        container.register(Trade)
        container.register(Litecoin)
        container.register(Cardano)
        container.register(AltCoins)
        const altcoin = container.resolve(AltCoins)
        expect(altcoin instanceof AltCoins).toBe(true)
        expect(altcoin.Trade instanceof Trade).toBe(true)
        expect(altcoin.cardano instanceof Cardano).toBe(true)
        expect(altcoin.litecoin instanceof Litecoin).toBe(true)
    })

    it("Should be able to resolve type with default constructor which uses base class constructor", () => {
        class Trade { }
        @decorIn.constructor()
        class AltCoins {
            constructor(public trade: Trade) { }
        }
        class AppleAltCoins extends AltCoins { }
        const container = new Container();
        container.register(Trade)
        container.register(AppleAltCoins)
        const altcoin = container.resolve(AppleAltCoins)
        expect(altcoin instanceof AltCoins).toBe(true)
        expect(altcoin instanceof AppleAltCoins).toBe(true)
        expect(altcoin.trade instanceof Trade).toBe(true)
    })

    it("Should resolve with scope Transient/Singleton properly", () => {
        class Btc { }
        class Doge { }
        const container = new Container()
        container.register(Btc).single()
        container.register(Doge)
        const btc = container.resolve(Btc)
        const doge = container.resolve(Doge)
        expect(container.resolve(Btc) == btc).toBe(true)
        expect(container.resolve(Doge) != doge).toBe(true)
    })

    it("Should able to register and resolve interface/named type", () => {
        interface Trade { }
        class Binance implements Trade { }
        interface Litecoin { }
        class Ltc implements Litecoin { }
        class Ada { }
        @decorIn.constructor()
        class AltCoins {
            constructor(
                @decorIn.name("Trade") public trade: Trade,
                public cardano: Ada,
                @decorIn.name("Litecoin") public litecoin: Litecoin) { }
        }
        const container = new Container();
        container.register("Trade").asType(Binance)
        container.register("Litecoin").asType(Ltc)
        container.register(Ada)
        container.register(AltCoins)
        const altcoin = container.resolve(AltCoins)
        expect(altcoin instanceof AltCoins).toBe(true)
        expect(altcoin.trade instanceof Binance).toBe(true)
        expect(altcoin.cardano instanceof Ada).toBe(true)
        expect(altcoin.litecoin instanceof Ltc).toBe(true)
    })

    it("Should resolve instance properly", () => {
        interface Cardano { }
        class Ada implements Cardano { }
        @decorIn.constructor()
        class AltCoins {
            constructor(@decorIn.name("Cardano") public cardano: Cardano) { }
        }
        const container = new Container();
        container.register("Cardano").asInstance(new Ada())
        container.register(AltCoins)
        const altcoin = container.resolve(AltCoins)
        expect(altcoin instanceof AltCoins).toBe(true)
        expect(altcoin.cardano instanceof Ada).toBe(true)
    })

    it("Should resolve instance with callback", () => {
        class Comprar { }
        interface Cardano { display: Comprar }
        class Ada implements Cardano {
            constructor(public display: Comprar) { }
        }
        @decorIn.constructor()
        class AltCoins {
            constructor(@decorIn.name("Cardano") public cardano: Cardano) { }
        }
        const container = new Container();
        container.register(Comprar)
        container.register("Cardano").asInstance(kernel => new Ada(kernel.solve(Comprar)))
        container.register(AltCoins)
        const altcoin = container.resolve(AltCoins)
        expect(altcoin instanceof AltCoins).toBe(true)
        expect(altcoin.cardano instanceof Ada).toBe(true)
        expect(altcoin.cardano.display instanceof Comprar).toBe(true)
    })

    it("Should be able to resolve auto factory", () => {
        class AltCoins { }
        const container = new Container();
        container.register(AltCoins)
        container.register("Factory<AltCoins>").asFactory(AltCoins)
        const altcoinFactory = container.resolve<Factory<AltCoins>>("Factory<AltCoins>")
        const altcoin = altcoinFactory.get()
        expect(altcoin instanceof AltCoins).toBe(true)
    })

    it("Auto factory should respect component registration life style", () => {
        class Btc { }
        class Doge { }
        const container = new Container()
        container.register(Btc).single()
        container.register(Doge)
        container.register("Factory<Btc>").asFactory(Btc)
        container.register("Factory<Doge>").asFactory(Doge)
        const btc = container.resolve(Btc)
        const doge = container.resolve(Doge)
        const btcFactory = container.resolve<Factory<Btc>>("Factory<Btc>")
        const dogeFactory = container.resolve<Factory<Doge>>("Factory<Doge>")
        expect(container.resolve(Btc)).toEqual(btc)
        expect(container.resolve(Doge) != doge).toBe(true)
        expect(btcFactory.get()).toEqual(btc)
        expect(dogeFactory.get() != doge).toBe(true)
    })

    it("Should be able to provide hook when component created", () => {
        class AltCoins { price = 5000 }
        const container = new Container();
        container.register(AltCoins).onCreated(i => {
            i.price = 2500;
            return i
        })
        const altcoin = container.resolve(AltCoins)
        expect(altcoin instanceof AltCoins).toBe(true)
        expect(altcoin.price).toEqual(2500)
    })

    it("Should be able to provide hook for named type", () => {
        class AltCoins { price = 5000 }
        const container = new Container();
        container.register("AltCoins").asType(AltCoins).onCreated(i => {
            i.price = 2500;
            return i
        })
        const altcoin = container.resolve<AltCoins>("AltCoins")
        expect(altcoin instanceof AltCoins).toBe(true)
        expect(altcoin.price).toEqual(2500)
    })

    it("Should be able to provide hook for named instance", () => {
        class AltCoins { price = 2000 }
        const container = new Container();
        container.register("AltCoins").asInstance(new AltCoins()).onCreated(i => {
            i.price = 2500;
            return i
        })
        const altcoin = container.resolve<AltCoins>("AltCoins")
        expect(altcoin instanceof AltCoins).toBe(true)
        expect(altcoin.price).toEqual(4000)
    })

    it("Should be able to provide hook for auto factory", () => {
        class AltCoins { price = 2000 }
        const container = new Container();
        container.register(AltCoins)
        container.register("AltCoinsFactory").asFactory(AltCoins).onCreated(i => {
            return i
        })
        const factory = container.resolve<Factory<AltCoins>>("AltCoinsFactory")
        expect(factory.get() instanceof AltCoins).toBe(true)
    })


    describe("Error Handling", () => {
        it("Should throw error if no resolver found for a id of ComponentModel", () => {
            const container = new Container()
            container.register(<AbModel>{ kind: "NotComponent", name: "Name", scope: "Plural" })
            expect(() => container.resolve("TheName")).toThrow("No resolver registered for component model id of NotAidOfComponent")
        })

        it("Should inform if a type not registered in the container", () => {
            class AltCoins { }
            const container = new Container()
            expect(() => container.resolve(AltCoins)).toThrow("Trying to resolve AltCoins but AltCoins is not registered in container")
        })

        it("Should inform if a named type not registered in the container", () => {
            const container = new Container()
            expect(() => container.resolve("AltCoins")).toThrow("Trying to resolve AltCoins but AltCoins is not registered in container")
        })

        it("Should inform circular dependency", () => {
            @decorIn.constructor()
            class AdaCoin {
                constructor(@decorIn.name("AltCoins") altcoin: any) { }
            }
            @decorIn.constructor()
            class Cardano {
                constructor(moneda: AdaCoin) { }
            }
            @decorIn.constructor()
            class AltCoins {
                constructor(cardano: Cardano) { }
            }
            const container = new Container()
            container.register(AdaCoin)
            container.register(Cardano)
            container.register("AltCoins").asType(AltCoins)
            expect(() => container.resolve("AltCoins")).toThrow("Circular dependency detected on: AltCoins -> Cardano -> AdaCoin -> AltCoins")
        })
    })
})
