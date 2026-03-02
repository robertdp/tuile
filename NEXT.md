Review these new goals of the current implementation. Take it with a grain of salt and red team each point. For each point: is it valid, and how do we address it?

<goals>

1. Turn the project into a modular monorepo with clear separation of concerns between core libraries, components, and examples.
  - Which intrinsic components should be part of the core library versus separate packages? Box and Text seem fundamental, but should we include Grid in the core or as separate components packages?
  - This is also to support the goal or writing 1st party components using JSX.
  - Also discuss whether we should use widgets or components as the naming convention for UI elements.

2. Rewrite the scrolling text component so that it doesn't rely on rendering/layout internals. And remove the `__` prefixed property it uses.
  - This is to ensure better encapsulation and maintainability of the component.

3. Pitch the project as a framework for building terminal UIs using declarative paradigms like JSX.
  - Emphasize the benefits of using a declarative approach for terminal UIs, such as improved readability, maintainability, and ease of composition.
  - Highlight how this approach can lead to more efficient development workflows and better user experiences in terminal applications.

4. Brainstorm and implement a set of high-level components/widgets that can be used to build complex terminal UIs.
  - Consider components like modals, tabs, accordions, and form elements.
  - Ensure these components are designed to be reusable and customizable.

</goals>