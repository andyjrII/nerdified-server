## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Create Admin Account

To create a test admin account, run:

```bash
npm run create-admin
```

This script will create a SUPER admin account with the following test credentials:
- **Email:** admin@nerdified.com
- **Password:** Admin@123
- **Name:** Admin User
- **Role:** SUPER

**Note:** If an admin with this email already exists, the script will skip creation.
