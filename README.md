# Congenica's adapted version of Panogram

To see the original README see [here](./panogram-README.md).

The instructions here are for developing and building panogram.

## Developing with webpack

do this:
```
npm ci # Needs npm >= 5.7.1
bower install
npm run dev
```
head to localhost:8080

### Building:

Before committing any changes you must run a build.

```
npm run build
```

Note: If you have run npm install and have updated the lock file this will likely break the CI.
