{
  "compilerOptions": {
    /* Type Checking */
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization: true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,

    /* Modules */
    "target": "ESNext",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "./",
    "outDir": "./dist",
    "removeComments": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,

    /* Completeness */
    "skipLibCheck": true
  },
  "include": ["src/**/*", "proxy.ts"],
  "exclude": ["node_modules", "dist"]
}
