import 'reflect-metadata'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Ignitor } from '@adonisjs/core'
import ts from 'typescript'
import contractsFixture, {
  type MiddlewareContract,
  type RouteContract,
} from './http_contracts.fixture.js'

type InputKind = 'body' | 'query'

interface RouteAudit {
  handlers: Record<string, string>
  issues: string[]
  routes: RouteContract[]
}

interface ValidationSite {
  handler: string
  inputKind: InputKind
  validator: string
}

interface ValidationAudit {
  issues: string[]
  sites: ValidationSite[]
}

interface ValidatorAudit {
  fingerprints: Record<string, string>
  issues: string[]
}

const contractsDirectory = dirname(fileURLToPath(import.meta.url))
const backendRoot = join(contractsDirectory, '..', '..')
const controllersDirectory = join(backendRoot, 'app', 'controllers')
const validatorsDirectory = join(backendRoot, 'app', 'validators')
const uuidMatcherSource =
  '^[0-9a-zA-F]{8}-[0-9a-zA-F]{4}-[0-9a-zA-F]{4}-[0-9a-zA-F]{4}-[0-9a-zA-F]{12}$'

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

function sortRoutes(routes: readonly RouteContract[]) {
  return [...routes].sort(([methodA, pathA], [methodB, pathB]) => {
    return compareText(pathA, pathB) || compareText(methodA, methodB)
  })
}

function sortRecord(record: Readonly<Record<string, string>>) {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => compareText(left, right))
  )
}

function routeKey(domain: string, method: string, path: string) {
  return `${domain} ${method} ${path}`
}

function useFailClosedEnvironment() {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    PORT: '3333',
    HOST: '127.0.0.1',
    LOG_LEVEL: 'silent',
    APP_KEY: 'contract-tests-only-key',
    DB_HOST: '127.0.0.1',
    DB_PORT: '1',
    DB_USER: 'contract_test',
    DB_PASSWORD: 'contract_test',
    DB_DATABASE: 'contract_test_no_connection',
    DRIVE_DISK: 'private_fs',
  })
}

async function controllerName(reference: unknown) {
  if (typeof reference !== 'function') {
    return undefined
  }

  if (reference.prototype) {
    return reference.name || undefined
  }

  const imported: unknown = await (reference as () => Promise<unknown>)()
  const controller =
    typeof imported === 'object' && imported !== null && 'default' in imported
      ? imported.default
      : imported

  return typeof controller === 'function' ? controller.name || undefined : undefined
}

async function readRegisteredRoutes(): Promise<RouteAudit> {
  useFailClosedEnvironment()

  const applicationRoot = pathToFileURL(`${backendRoot}/`)
  const application = new Ignitor(applicationRoot, {
    importer: (filePath: string) => {
      return import(
        filePath.startsWith('./') || filePath.startsWith('../')
          ? new URL(filePath, applicationRoot).href
          : filePath
      )
    },
  }).createApp('console')

  application.booting(async () => {
    await import('#start/env')
  })
  await application.init()

  try {
    await application.boot()
    await application.start(async () => undefined)

    const router = await application.container.make('router')
    router.commit()

    const handlers: Record<string, string> = {}
    const issues: string[] = []
    const routes: RouteContract[] = []

    for (const domainRoutes of Object.values(router.toJSON())) {
      for (const registered of domainRoutes) {
        const middleware: MiddlewareContract[] = []

        for (const entry of registered.middleware.all()) {
          if (typeof entry !== 'function' && entry.name) {
            middleware.push([entry.name, entry.args ?? null])
          }
        }

        if (registered.domain !== contractsFixture.domain) {
          issues.push(
            `${registered.methods.join('|')} ${registered.pattern}:domain=${registered.domain}`
          )
        }

        for (const parameter of registered.pattern.matchAll(/:([A-Za-z0-9_]+)/g)) {
          const matcher = registered.matchers[parameter[1]]
          const pattern = matcher?.match
          if (
            !pattern ||
            pattern.source !== uuidMatcherSource ||
            pattern.flags !== '' ||
            typeof matcher?.cast !== 'function'
          ) {
            issues.push(`${registered.methods.join('|')} ${registered.pattern}:${parameter[1]}`)
          }
        }

        const reference =
          typeof registered.handler === 'function' ? undefined : registered.handler.reference
        const resolvedController = Array.isArray(reference)
          ? await controllerName(reference[0])
          : undefined
        const action =
          Array.isArray(reference) && typeof reference[1] === 'string' ? reference[1] : undefined

        for (const method of registered.methods) {
          if (method === 'HEAD') {
            continue
          }

          routes.push([method, registered.pattern, middleware])
          if (resolvedController && action) {
            handlers[routeKey(registered.domain, method, registered.pattern)] =
              `${resolvedController}.${action}`
          }
        }
      }
    }

    return {
      handlers: sortRecord(handlers),
      issues: issues.sort(compareText),
      routes: sortRoutes(routes),
    }
  } finally {
    await application.terminate()
  }
}

let routeAuditPromise: Promise<RouteAudit> | undefined

function registeredRoutes() {
  routeAuditPromise ??= readRegisteredRoutes()
  return routeAuditPromise
}

async function sourceFiles(directory: string) {
  const entries = await readdir(directory, { recursive: true })
  const files: Array<{ file: string; source: ts.SourceFile }> = []

  for (const file of entries.filter((entry) => entry.endsWith('.ts')).sort(compareText)) {
    const contents = await readFile(join(directory, file), 'utf8')
    files.push({
      file,
      source: ts.createSourceFile(file, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
    })
  }

  return files
}

function requestBinding(method: ts.MethodDeclaration) {
  for (const parameter of method.parameters) {
    if (!ts.isObjectBindingPattern(parameter.name)) {
      continue
    }

    for (const element of parameter.name.elements) {
      const property = element.propertyName?.getText() ?? element.name.getText()
      if (property === 'request' && ts.isIdentifier(element.name)) {
        return element.name.text
      }
    }
  }

  return undefined
}

function requestCall(node: ts.Node, requestName: string) {
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === requestName
  ) {
    return node.expression.name.text
  }

  return undefined
}

function queryValidator(call: ts.CallExpression) {
  const parent = call.parent
  if (
    ts.isCallExpression(parent) &&
    parent.arguments.includes(call) &&
    ts.isPropertyAccessExpression(parent.expression) &&
    parent.expression.name.text === 'validate' &&
    ts.isIdentifier(parent.expression.expression)
  ) {
    return parent.expression.expression.text
  }

  return undefined
}

function isValidatedRequestReference(node: ts.Identifier, requestName: string) {
  if (node.text !== requestName) {
    return true
  }

  const access = node.parent
  const call = ts.isPropertyAccessExpression(access) ? access.parent : undefined
  if (
    !ts.isPropertyAccessExpression(access) ||
    access.expression !== node ||
    !call ||
    !ts.isCallExpression(call) ||
    call.expression !== access
  ) {
    return false
  }

  return (
    access.name.text === 'validateUsing' || (access.name.text === 'qs' && !!queryValidator(call))
  )
}

function validatorAliases(source: ts.SourceFile) {
  const aliases = new Map<string, string>()

  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.moduleSpecifier.text.includes('validators') ||
      !statement.importClause?.namedBindings ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      continue
    }

    for (const imported of statement.importClause.namedBindings.elements) {
      aliases.set(imported.name.text, imported.propertyName?.text ?? imported.name.text)
    }
  }

  return aliases
}

async function auditControllerValidations(): Promise<ValidationAudit> {
  const issues = new Set<string>()
  const sites: ValidationSite[] = []

  for (const { source } of await sourceFiles(controllersDirectory)) {
    const aliases = validatorAliases(source)

    for (const statement of source.statements) {
      if (!ts.isClassDeclaration(statement) || !statement.name) {
        continue
      }

      for (const member of statement.members) {
        if (!ts.isMethodDeclaration(member) || !member.body) {
          continue
        }

        const action =
          ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)
            ? member.name.text
            : member.name.getText(source)
        const handler = `${statement.name.text}.${action}`
        const requestName = requestBinding(member)
        const initialSiteCount = sites.length

        const visit = (node: ts.Node) => {
          if (
            requestName &&
            ts.isIdentifier(node) &&
            !isValidatedRequestReference(node, requestName)
          ) {
            issues.add(`${handler}:requestEscape`)
          }

          const callName = requestName ? requestCall(node, requestName) : undefined
          if (callName === 'validateUsing' && ts.isCallExpression(node)) {
            const validator = node.arguments[0]
            if (validator && ts.isIdentifier(validator)) {
              sites.push({
                handler,
                inputKind: 'body',
                validator: aliases.get(validator.text) ?? validator.text,
              })
            } else {
              issues.add(`${handler}:invalidValidateUsing`)
            }
          } else if (callName === 'qs' && ts.isCallExpression(node)) {
            const validator = queryValidator(node)
            if (validator) {
              sites.push({
                handler,
                inputKind: 'query',
                validator: aliases.get(validator) ?? validator,
              })
            } else {
              issues.add(`${handler}:unvalidatedQuery`)
            }
          }

          ts.forEachChild(node, visit)
        }

        visit(member.body)
        if (requestName && sites.length === initialSiteCount) {
          issues.add(`${handler}:unvalidatedRequest`)
        }
      }
    }
  }

  return {
    issues: [...issues].sort(compareText),
    sites: sites.sort((left, right) => {
      return (
        compareText(left.handler, right.handler) ||
        compareText(left.inputKind, right.inputKind) ||
        compareText(left.validator, right.validator)
      )
    }),
  }
}

function exportedValidatorDeclarations(statement: ts.Statement) {
  if (
    !ts.isVariableStatement(statement) ||
    !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  ) {
    return []
  }

  return statement.declarationList.declarations.filter((declaration) => {
    return ts.isIdentifier(declaration.name) && declaration.name.text.endsWith('Validator')
  })
}

function isVineCompile(initializer: ts.Expression | undefined): initializer is ts.CallExpression {
  return (
    !!initializer &&
    ts.isCallExpression(initializer) &&
    ts.isPropertyAccessExpression(initializer.expression) &&
    ts.isIdentifier(initializer.expression.expression) &&
    initializer.expression.expression.text === 'vine' &&
    initializer.expression.name.text === 'compile'
  )
}

async function auditValidators(): Promise<ValidatorAudit> {
  const fingerprints: Record<string, string> = {}
  const issues: string[] = []
  const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed })

  for (const { file, source } of await sourceFiles(validatorsDirectory)) {
    const support = source.statements
      .filter((statement) => {
        return (
          !ts.isImportDeclaration(statement) &&
          exportedValidatorDeclarations(statement).length === 0
        )
      })
      .map((statement) => printer.printNode(ts.EmitHint.Unspecified, statement, source))
      .join('\n')

    for (const statement of source.statements) {
      for (const declaration of exportedValidatorDeclarations(statement)) {
        if (!ts.isIdentifier(declaration.name)) {
          continue
        }

        const name = declaration.name.text
        if (Object.hasOwn(fingerprints, name)) {
          issues.push(`${name}:duplicate`)
        }
        if (!isVineCompile(declaration.initializer)) {
          issues.push(`${file}:${name}:notVineCompile`)
          continue
        }

        const schema = printer.printNode(ts.EmitHint.Expression, declaration.initializer, source)
        fingerprints[name] = createHash('sha256')
          .update(support ? `${support}\n${schema}` : schema)
          .digest('hex')
      }
    }
  }

  return { fingerprints: sortRecord(fingerprints), issues: issues.sort(compareText) }
}

function endpointValidationContracts(
  routeAudit: RouteAudit,
  validationAudit: ValidationAudit,
  validatorAudit: ValidatorAudit
) {
  const contracts: Record<string, string> = {}
  const issues: string[] = []
  const sitesByHandler = new Map<string, ValidationSite[]>()

  for (const site of validationAudit.sites) {
    const handlerSites = sitesByHandler.get(site.handler) ?? []
    handlerSites.push(site)
    sitesByHandler.set(site.handler, handlerSites)
  }

  const routedHandlers = new Set(Object.values(routeAudit.handlers))
  for (const site of validationAudit.sites) {
    if (!routedHandlers.has(site.handler)) {
      issues.push(`${site.handler}:notRouted`)
    }
  }

  for (const [route, handler] of Object.entries(routeAudit.handlers)) {
    for (const site of sitesByHandler.get(handler) ?? []) {
      const key = `${route}:${site.inputKind}`
      const fingerprint = validatorAudit.fingerprints[site.validator]
      if (!fingerprint) {
        issues.push(`${key}:missingValidator:${site.validator}`)
      } else if (Object.hasOwn(contracts, key)) {
        issues.push(`${key}:duplicateValidation`)
      } else {
        contracts[key] = fingerprint
      }
    }
  }

  return { contracts: sortRecord(contracts), issues: issues.sort(compareText) }
}

test(
  'preserves all 59 public routes, middleware configurations, and UUID matchers',
  { timeout: 15_000 },
  async () => {
    const audit = await registeredRoutes()

    assert.equal(contractsFixture.routes.length, 59)
    assert.equal(audit.routes.length, 59)
    assert.deepEqual(audit.issues, [])
    assert.deepEqual(audit.routes, sortRoutes(contractsFixture.routes))
  }
)

test(
  'preserves validation behavior without freezing controller or validator organization',
  { timeout: 15_000 },
  async () => {
    const routeAudit = await registeredRoutes()
    const validationAudit = await auditControllerValidations()
    const validatorAudit = await auditValidators()
    const endpointAudit = endpointValidationContracts(routeAudit, validationAudit, validatorAudit)
    const usedValidators = [
      ...new Set(validationAudit.sites.map(({ validator }) => validator)),
    ].sort(compareText)

    assert.deepEqual(validationAudit.issues, [])
    assert.deepEqual(validatorAudit.issues, [])
    assert.deepEqual(usedValidators, Object.keys(validatorAudit.fingerprints).sort(compareText))
    assert.deepEqual(endpointAudit.issues, [])
    assert.deepEqual(endpointAudit.contracts, sortRecord(contractsFixture.validationRules))
  }
)
