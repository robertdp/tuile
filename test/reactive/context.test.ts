import { describe, it, expect } from "vitest";
import { h } from "../../src/element/h.js";
import { mount, unmount } from "../../src/element/reconciler.js";
import { createContext, useContext } from "../../src/reactive/context.js";
import { Box } from "../../src/primitives/Box.js";
import { Text } from "../../src/primitives/Text.js";

describe("createContext / useContext", () => {
  it("provides and consumes a value", () => {
    const ThemeCtx = createContext("light");
    let receivedTheme = "";

    const Consumer = () => {
      receivedTheme = useContext(ThemeCtx);
      return h(Text, {}, receivedTheme);
    };

    const el = h(ThemeCtx.Provider, { value: "dark" }, h(Consumer, {}));
    const node = mount(el);

    expect(receivedTheme).toBe("dark");

    unmount(node);
  });

  it("returns default value when no provider", () => {
    const Ctx = createContext(42);
    let receivedValue = 0;

    const Consumer = () => {
      receivedValue = useContext(Ctx);
      return h(Text, {}, String(receivedValue));
    };

    const el = h(Consumer, {});
    const node = mount(el);

    expect(receivedValue).toBe(42);

    unmount(node);
  });

  it("nested providers — inner overrides outer", () => {
    const Ctx = createContext("default");
    let innerValue = "";
    let outerValue = "";

    const InnerConsumer = () => {
      innerValue = useContext(Ctx);
      return h(Text, {}, innerValue);
    };

    const OuterConsumer = () => {
      outerValue = useContext(Ctx);
      return h(Box, {},
        h(Ctx.Provider, { value: "inner" },
          h(InnerConsumer, {}),
        ),
      );
    };

    const el = h(Ctx.Provider, { value: "outer" }, h(OuterConsumer, {}));
    const node = mount(el);

    expect(outerValue).toBe("outer");
    expect(innerValue).toBe("inner");

    unmount(node);
  });

  it("sibling consumers get the same provider value", () => {
    const Ctx = createContext("");
    const values: string[] = [];

    const Consumer = (props: { id: number }) => {
      values.push(useContext(Ctx));
      return h(Text, {}, `consumer-${props.id}`);
    };

    const el = h(Ctx.Provider, { value: "shared" },
      h(Consumer, { id: 1 }),
      h(Consumer, { id: 2 }),
    );
    const node = mount(el);

    expect(values).toEqual(["shared", "shared"]);

    unmount(node);
  });

  it("multiple independent contexts", () => {
    const ThemeCtx = createContext("light");
    const LangCtx = createContext("en");
    let theme = "";
    let lang = "";

    const Consumer = () => {
      theme = useContext(ThemeCtx);
      lang = useContext(LangCtx);
      return h(Text, {}, `${theme}-${lang}`);
    };

    const el = h(ThemeCtx.Provider, { value: "dark" },
      h(LangCtx.Provider, { value: "fr" },
        h(Consumer, {}),
      ),
    );
    const node = mount(el);

    expect(theme).toBe("dark");
    expect(lang).toBe("fr");

    unmount(node);
  });
});
