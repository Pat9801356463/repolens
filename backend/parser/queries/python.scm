; parser/queries/python.scm — Phase 1
;
; tree-sitter query patterns used by extractors.py to pull the raw
; syntactic pieces we need out of a Python file. Kept deliberately
; shallow: extractors.py does the semantic resolution (which import
; goes with which call, etc.) in Python, not here.

; --- Module-level and nested function definitions ---
(function_definition
  name: (identifier) @function.name) @function.def

; --- Class definitions, with optional base classes ---
(class_definition
  name: (identifier) @class.name
  superclasses: (argument_list (identifier) @class.base)?) @class.def

; --- `import x`, `import x.y.z`, `import x as y` ---
(import_statement
  name: (dotted_name) @import.module) @import.stmt

(import_statement
  name: (aliased_import
    name: (dotted_name) @import.module
    alias: (identifier) @import.alias)) @import.stmt

; --- `from x import y`, `from x import y as z`, `from . import y` ---
(import_from_statement
  module_name: (dotted_name)? @import.from_module
  name: (dotted_name) @import.name) @import.from_stmt

(import_from_statement
  module_name: (dotted_name)? @import.from_module
  name: (aliased_import
    name: (dotted_name) @import.name
    alias: (identifier) @import.alias)) @import.from_stmt

; --- Relative imports: `from . import x`, `from .services import x` ---
(import_from_statement
  module_name: (relative_import) @import.relative_module
  name: (dotted_name) @import.name) @import.from_stmt

; --- Direct-name function calls: foo(...) ---
; (attribute calls like self.service.charge() are intentionally
; excluded per blueprint §4 — no type inference in Phase 1)
(call
  function: (identifier) @call.name) @call.expr

; --- Decorators, useful for API_ROUTE detection (e.g. @app.get("/x")) ---
(decorator
  (call
    function: (attribute
      object: (identifier) @decorator.object
      attribute: (identifier) @decorator.attribute)
    arguments: (argument_list . (string) @decorator.arg))) @decorator.full
