<div id="top"></div>

<!-- PROJECT LOGO -->
<br />
  <a href="https://github.com/unfoldingWord">
    <img src="images/uW.png" alt="Logo" width="300" height="50">
  </a>

# Door43 Preview

#### Bible resources preview 
- using [oce-editor-tools](https://github.com/unfoldingWord/oce-editor-tools) underneath

The app is available <a href="https://door43-preview.netlify.app/"><strong>here</strong></a>

<a href="https://github.com/unfoldingWord-box3/door43-preview-app/issues">Report Bug</a>
·
<a href="https://github.com/unfoldingWord-box3/door43-preview-app/issues">Request Feature</a>

<p>
<a href="https://opencomponents.io/" title="Door43 Preview is part of the OCE"><img src="https://img.shields.io/badge/OCE-component-green?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNDcuNDEgMTQ3LjQxIj48dGl0bGU+b2NlX2NvbXBvbmVudDwvdGl0bGU+PGcgaWQ9IkNhcGFfMiIgZGF0YS1uYW1lPSJDYXBhIDIiPjxnIGlkPSJDYXBhXzEtMiIgZGF0YS1uYW1lPSJDYXBhIDEiPjxwYXRoIGQ9Ik04Ny4xNSw4Ny4zM2MtNy41MSw3LjUzLTguMzYsMjIuNSw4LjExLDI1LjI3LDguMjcsMS40MywxMS42LDUuNCw4LDEwLjE0TDc4LjU3LDE0Ny40MSw0OSwxMTcuODhjLTQuNzMtMy42MS04LjctLjI5LTEwLjEzLDgtMi43NywxNi40OC0xNy43NCwxNS42My0yNS4yNyw4LjEybC0uMTktLjE5Yy03LjUtNy41Mi04LjM1LTIyLjQ5LDguMTItMjUuMjcsOC4yOC0xLjQzLDExLjYtNS40LDgtMTAuMTNMMCw2OC44NSwyNC42OCw0NC4xN2M0Ljc0LTMuNjEsOC43MS0uMjgsMTAuMTMsOCwyLjc4LDE2LjQ4LDE3Ljc1LDE1LjYzLDI1LjI4LDguMTJsLjE4LS4xOGM3LjUtNy41NCw4LjM2LTIyLjUxLTguMTItMjUuMjgtOC4yNi0xLjQyLTExLjYtNS40LTgtMTAuMTNMNjguODUsMCw5OC4zOSwyOS41NGM0LjcyLDMuNjEsOC43LjI5LDEwLjEyLTgsMi43Ny0xNi40OCwxNy43NC0xNS42MiwyNS4yOC04LjEybC4xOS4xOWM3LjQ5LDcuNTIsOC4zNCwyMi41LTguMTIsMjUuMjctOC4yOCwxLjQzLTExLjYsNS40MS04LDEwLjEzbDI5LjU0LDI5LjU1LTI0LjY3LDI0LjY4Yy00Ljc0LDMuNjEtOC43MS4yOC0xMC4xNC04LTIuNzgtMTYuNDgtMTcuNzUtMTUuNjItMjUuMjctOC4xMVoiIHN0eWxlPSJmaWxsOiMyZjVjNmUiLz48L2c+PC9nPjwvc3ZnPg==&amp;style=for-the-badge&amp;labelColor=ffffff&amp;?color=2f5c6e" alt="Open Components Ecosystem"></a>
<a href="https://discord.com/channels/867746700390563850/867746700390563853" title="OCE discord server"><img src="https://img.shields.io/badge/Discord-%235865F2.svg?style=for-the-badge&amp;logo=discord&amp;logoColor=white" alt="Discord"></a>
<a href="https://github.com/unfoldingWord-box3/door43-preview-app/blob/HEAD/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=for-the-badge" alt="license"></a>
</p>

---

## Features

- Offering an easy to use app for printing Bible text and Bible Stories.
- The various underlying components are assembled together in a simple user interface.
- Most of the features are made available from the underlying components, meaning that the size of code in this app is kept rather small.

---

## Support

Having trouble? Get help in the official [Open Components Ecosystem Discord](https://discord.com/channels/867746700390563850/1019675732324143205).

---

<!-- ABOUT THE PROJECT -->
## About The Project

![Door43 Preview Screenshot](./images/screenshot.png)

### Purpose

This app is basically just a wrapper  for other components (a reference implementation app).

These are some of the underlying components:

- [OCE Editor Tools](https://github.com/oce-editor-tools) Multiple re-usable editor and preview components packaged into a library (monorepo). These are meant to be integrated into applications for editing and viewing scripture text in USFM format.

- [Epitelete-html](https://github.com/unfoldingWord/epitelete-html) HTML handling in Epitelete - as a derived sub-class. All the [original Epitelete](https://github.com/Proskomma/epitelete) parent functions are inherited and then extended with more functions for generating and parsing Html.

- [proskomma-core](https://github.com/Proskomma/proskomma-core) An implementation of the Proskomma Scripture Processing Model.

<p align="right">(<a href="#top">back to top</a>)</p>

### Built With

- [React.js](https://reactjs.org/)

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- ROADMAP -->
## Roadmap

See the [open issues](https://github.com/unfoldingWord-box3/door43-preview-app/issues) for a full list of proposed features (and any known issues).

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- CONTRIBUTING -->
## Contributing

The open source community is an amazing place to learn, inspire, and create. So, any contributions you make are **greatly appreciated**.  [Guidelines for rcl development](https://forum.door43.org/t/rcl-app-development-process/605) and [general information](https://forum.door43.org).

You can, for instance, simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

If you would like to fork the repo and create a pull request.

1. Fork the Project
2. Clone the repo

   ```sh
   git clone https://github.com/unfoldingWord-box3/door43-preview-app.git
   ```

3. Install packages

   ```sh
   pnpm install
   ```

4. Run locally:

   ```sh
   pnpm run dev
   ```

5. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
6. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
7. Push to the Branch (`git push origin feature/AmazingFeature`)
8. Open a Pull Request

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE` for more information.

<p align="right">(<a href="#top">back to top</a>)</p>



