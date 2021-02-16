/* 
Type    :   Typescript
Version :   1.0 
Github  :   https://github.com/michealandrecoverdale/iocTest.git
*/


import "reflect-metadata";

/* ------------------ */
/* ----- TYPES ------ */
/* -------------------*/

type Class<A> = new (...args: any[]) => A
type Lifetime = "Single" | "Plural"
type SConstructor = new (kernel: Kernel, cache: { [key: string]: any }) => SoyConstructor

interface Index { index: number, name: string}
interface SoyConstructor { solve<A>(config: AbModel): A }
interface Kernel { solve<A>(type: Class<A> | string): A }
interface Factory<A> { get(): A }

interface AbModel {
    kind: string,
    name: string,
    scope: Lifetime,
    analyzed: boolean
    onCreatedCallback?: (instance: any, kernel: Kernel) => any
}

interface ModelModifier<A> {
    single(): ModelModifier<A>,
    onCreated(callback: (instance: A, kernel: Kernel) => A): ModelModifier<A>
}

/* ------------------ */
/* ----- CACHE ------ */
/* -------------------*/

const NAME_KEY = "milane:named-type"

const RESOLVERS: { [kind: string]: SConstructor } = {}

/* ------------------- */
/* ----- HELPER ------ */
/* --------------------*/

function getMetadata<A>(key: string, target: any) {
    return (<A[]>Reflect.getMetadata(key, target) || [])
}

function getConstructorParameters(target: Class<any>) {
    
    const parameterTypes = getMetadata<Class<any>>("design:paramtypes", target)
  
    const decorators = getMetadata<Index>(NAME_KEY, target).reverse()
   
    return parameterTypes.map((x, i) => {
        const decorator = decorators.filter(x => x.index == i)[0]
        return decorator ? decorator.name : x
    })
}

function ConstructorParameters(target: Class<any>): (string | Class<any>)[] {
    
    if (target.length > 0) return getConstructorParameters(target)
   
    if (!Boolean(target.prototype)) return []
    else
        return ConstructorParameters(Object.getPrototypeOf(target))
}

function getComponentName(component: string | Class<any>) {
    return typeof component == "string" ? component : component.prototype.constructor.name
}

/* ------------------- */
/* ----- DECORS ------ */
/* --------------------*/

namespace decorIn {

    export function constructor() { return (target: any) => { } }

    export function name(name: string) {
        return (target: any, propertyName: string, index: number) => {
            const list = getMetadata<Index>(NAME_KEY, target).concat([{ index, name}])
            Reflect.defineMetadata(NAME_KEY, list, target)
        }
    }
}

function solucion(kind: string) {
    return (target: SConstructor) => {
        RESOLVERS[kind] = target
    }
}

/* ---------------------- */
/* ----- CONTAINER ------ */
/* -----------------------*/

abstract class AbModelBase<A> implements AbModel, ModelModifier<A> {
    abstract kind: string;
    abstract name: string;
    analyzed: boolean = false;
    scope: Lifetime = "Plural"
    onCreatedCallback?: (instance: any, kernel: Kernel) => any;
    single(): ModelModifier<A> {
        this.scope = "Single"
        return this
    }
    onCreated(callback: (instance: A, kernel: Kernel) => A): ModelModifier<A> {
        this.onCreatedCallback = callback
        return this
    }
}

abstract class SolvedBase implements SoyConstructor {
    protected abstract getInstance(typeInfo: AbModel): any
    constructor(protected kernel: Kernel, protected cache: { [key: string]: any }) { }
    solve<A>(component: AbModel): A {
        if (component.scope == "Single") {
            let cache = this.cache[component.name]
            if (!cache) this.cache[component.name] = cache = this.getInstance(component)
            return cache
        }
        else {
            if (component.onCreatedCallback)
                return component.onCreatedCallback(this.getInstance(component), this.kernel)
            else
                return this.getInstance(component)
        }
    }
}

class GraphAnalyzer {
    constructor(private models: AbModel[], private callback?:(path:string) => void) { }
    
    private getModelByNameOrType(type: string | Class<any>): AbModel | undefined {
        const filter = (x: AbModel) =>
            typeof type == "function" && x instanceof TypeModel ?
                x.type == type : x.name == type
        return this.models.filter(filter)[0]
    }

    private Analyze(path: (string | Class<any>)[], model?: AbModel): string|  undefined {

        if (model && model.analyzed) return
        const curName = getComponentName(path[path.length - 1])
        const curPath = path.map(x => getComponentName(x)).join(" -> ")
        if(this.callback) this.callback(curPath)
        if (!model) return `Trying to solve ${curPath} but ${curName} is not registered in container`
        else {
            if (this.hasCircularDependency(path, model)) return `Circular dependency detected on: ${curPath}`
            if (model instanceof TypeModel) {
                for (let dependency of model.dependencies) {
                    const analysis = this.Analyze(path.concat(dependency), this.getModelByNameOrType(dependency))
                    model.analyzed = true
                    if (analysis) return analysis
                }
            }
        }
    }

    private hasCircularDependency(path: (string | Class<any>)[], model: AbModel){
        
        const matchName = (x: string | Class<any>) => (typeof x == "string" && x == model.name)
        const matchType = (x: string | Class<any>) => (typeof x == "function" && model instanceof TypeModel && x == model.type)
 
        const testPath = path.slice(0, -1)
  
        return (testPath.some(matchName) || testPath.some(matchType))
    }

    analyze(request: string | Class<any>) {
        const model = this.getModelByNameOrType(request)
        const analysis = this.Analyze([request], model)
        if (analysis) throw new Error(analysis)
    }
}

class Container implements Kernel {
    private singleCache: { [name: string]: any } = {}
    private models: AbModel[] = []
    private resolver: { [kind: string]: SoyConstructor } = {}
    private analyzer: GraphAnalyzer

    constructor() {

        Object.keys(RESOLVERS).forEach(x => {
            return this.resolver[x] = new RESOLVERS[x](this, this.singleCache);
        })
        this.analyzer = new GraphAnalyzer(this.models)
    }
    solve<A>(type: string | Class<A>): A {
        throw new Error("Method not implemented.");
    }
    private getModelByNameOrType(type: string | Class<any>): AbModel | undefined {
        const filter = (x: AbModel) =>
            typeof type == "function" && x instanceof TypeModel ?
                x.type == type : x.name == type
        return this.models.filter(filter)[0]
    }

    register<A>(name: string): NewComponent

  
    register<A>(type: Class<A>): ModelModifier<A>


    register<A>(model: AbModel): void


    register<A>(nameOrComponent: string | Class<A> | AbModel): NewComponent | ModelModifier<A> | void {
        if (typeof nameOrComponent == "string")
            return new NewComponent(this.models, nameOrComponent)
        else if (typeof nameOrComponent == "object") {
            this.models.push(nameOrComponent)
        }
        else {
            const model = new TypeModel<A>(nameOrComponent)
            this.models.push(model)
            return model
        }
    }

    private solveModel<A>(model: AbModel): A {
        const constructor = this.resolver[model.kind]
        if (!constructor) throw new Error(`No constructor registered for component model kind of ${model.name}`)
        return constructor.constructor(model)
    }


    resolve<A>(type: Class<A> | string): A {
        this.analyzer.analyze(type)
        return this.solveModel(this.getModelByNameOrType(type)!)
    }
}


/* -----------------------------*/
/* ------ IMPLEMENTATION ------ */
/* -----------------------------*/


class TypeModel<A> extends AbModelBase<A> {
    kind = "Type"
    name: string
    dependencies: (Class<A> | string)[]
    constructor(public type: Class<A>, name?: string) {
        super()
        this.name = name || type.prototype.constructor.name
        this.dependencies = ConstructorParameters(type)
    }
}

@solucion("Type")
class TypeSolved extends SolvedBase {
    protected getInstance<A>(config: TypeModel<A>): A {
        return new config.type(...config.dependencies.map(x => this.kernel.constructor(x)))
    }
}

/* ------------------------*/
/* ------ INJECTION ------ */
/* ------------------------*/

class InstanceAbModel<A> extends AbModelBase<A> {
    kind = "Instance"
    constructor(public value: A | ((kernel: Kernel) => A), public name: string) {
        super()
    }
}

@solucion("Instance")
class InstanceSolved extends SolvedBase {
    protected getInstance<A>(info: InstanceAbModel<A>): A {
        if (typeof info.value == "function")
            return (info.value as Function)(this.kernel)
        else
            return info.value
    }
}

class AFModel extends AbModelBase<any> {
    kind = "Factory"
    constructor(public component: Class<any> | string, public name: string) {
        super()
    }
}

class AFImpl<A> implements Factory<A>{
    constructor(private kernel: Kernel, private component: string | Class<A>) { }
    get(): A {
        return this.kernel.solve(this.component)
    }
}

@solucion("Factory")
class AFSolved extends SolvedBase {
    protected getInstance<A>(info: AFModel) {
        return new AFImpl(this.kernel, info.component)
    }
}

/* ------------------------*/
/* ------ REGISTER ------- */
/* ------------------------*/

class NewComponent{
    constructor(private models: AbModel[], private name: string) { }

    private add<A>(model: any): ModelModifier<A> {
        this.models.push(model)
        return model
    }

    asType<A>(type: Class<A>): ModelModifier<A> {
        return this.add(new TypeModel<A>(type, this.name))
    }

    asInstance<A>(instance: A | ((kernel: Kernel) => A)): ModelModifier<A> {
        return this.add(new InstanceAbModel<A>(instance, this.name))
    }

    asFactory<A>(component: string | Class<A>): ModelModifier<Factory<A>> {
        return this.add(new AFModel(component, this.name))
    }
}

export {
    Class,   
    Kernel,  
    AbModel,
    AFModel,
    decorIn,
    Factory,
    Lifetime,
    Container,
    TypeModel,
    NewComponent,
    ModelModifier,
    GraphAnalyzer,
    InstanceAbModel,
}