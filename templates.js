import { createComponent, createComponentId } from "./component-registry.js";

export function createLandingHeroTemplate({ x, y, startZ = 10 }) {
  const sectionId = createComponentId("section");
  return [
    createComponent("section", {
      id: sectionId,
      name: "Hero Section",
      x,
      y,
      width: 900,
      height: 420,
      z: startZ,
      props: { label: "Hero Section" },
      styles: {
        desktop: { backgroundColor: "#f6f8fc", borderRadius: "16px" },
        mobile: { padding: "20px" }
      }
    }),
    createComponent("text", {
      name: "Hero Heading",
      parentId: sectionId,
      x,
      y: y - 70,
      width: 620,
      height: 90,
      z: startZ + 1,
      props: { text: "Build without limits" },
      styles: {
        desktop: { fontSize: "48px", fontWeight: "750", textAlign: "center", color: "#172033" },
        tablet: { fontSize: "40px" },
        mobile: { fontSize: "32px" }
      }
    }),
    createComponent("text", {
      name: "Hero Description",
      parentId: sectionId,
      x,
      y: y + 20,
      width: 560,
      height: 60,
      z: startZ + 2,
      props: { text: "Design pages on an infinite canvas and export production-ready output." },
      styles: {
        desktop: { fontSize: "18px", fontWeight: "400", textAlign: "center", color: "#526078" },
        mobile: { fontSize: "16px" }
      }
    }),
    createComponent("button", {
      name: "Hero Action",
      parentId: sectionId,
      x,
      y: y + 105,
      width: 180,
      z: startZ + 3,
      props: { text: "Start Creating", href: "#" }
    })
  ];
}
