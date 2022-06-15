# spin-vscode

[Spin](https://spin.fermyon.dev) is a framework for building, deploying, and running fast, secure, and composable
cloud microservices with WebAssembly. This extension integrates Spin developer
tasks into the Visual Studio Code editor.

The project is at a very early stage. It currently provides the following features:

* Tasks for building and running Spin applications (`spin: build` and `spin: up`)

## Configuration

The extension provides the following configuration options:

* `spin.customProgramPath`: By default, the extension downloads and uses a compatible version
  of Spin for you.  If you want to use your own copy of Spin, provide the full path
  (including filename and extension) here.  This can be useful if you are working on
  Spin itself and want to use your development build.

## Contributing

We welcome contributions, whether bug reports, feature suggestions, or pull requests.
Any contribution and interaction on this or any Fermyon project MUST follow our
[code of conduct](https://www.fermyon.com/code-of-conduct). Thank you for being
part of an inclusive and open community!
