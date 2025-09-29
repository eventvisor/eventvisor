# project-monorepo

This is an example of a monorepo where multiple Eventvisor projects can be managed from a single repository.

Visit the website for more information: https://eventvisor.org

## Initialization

```
$ mkdir my-monorepo && cd my-monorepo
$ npx eventvisor init --project=monorepo
```

## Projects

You will find multiple projects inside the `projects` directory.

### Creating a new project

You can copy an existing project directory, and then modify the project's name in its `package.json` file.

### Install

Run `npm install` in the root directory to install the dependencies for all the projects.

## Usage

From root, you can make use of already provided `make` commands:

```
$ make lint
$ make build
$ make test
```

Or you can run the commands directly from the projects' directories.

## Deployment

All the projects' datafiles can be found in the `datafiles` directory, which you can upload in one go to your CDN or custom web server.
