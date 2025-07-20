# Metadata Class Design Notes

## API Design (Similar to Go's http.Header)

The Metadata class provides a case-insensitive API similar to Go's http.Header:

- `get(key)` - Returns the first value for the given key (case-insensitive)
- `getValues(key)` - Returns all values for the given key (case-insensitive) 
- `toJSON()` - Returns a simple Record<string, string> with first values
- `toJSONFull()` - Returns the full structure with all values and refinements

## Key Normalization

Property names are normalized to lowercase for case-insensitive access:
- "Title" → "title"
- "CREATOR" → "creator"
- "dc:Title" → "title"

## Storage Structure

- `propertiesByName`: Map<string, DCProperty[]> - stores normalized keys
- `propertiesById`: Map<string, DCProperty> - stores fragment IDs with # prefix

## API Changes

### New Methods
- `get(key: string): string` - Case-insensitive, returns first value or ""
- `getValues(key: string): string[]` - Case-insensitive, returns all values
- `toJSON(): Record<string, string>` - Simple key-value pairs with first values

### Renamed Methods
- `get()` → `getProperties()` - To avoid confusion with new case-insensitive `get()`
- `toJSON()` → `toJSONFull()` - The original method that returns full structure

### Unchanged Methods
- `getText(name)` - Returns first value (will be deprecated in favor of `get()`)
- `getById(id)` - Fragment ID lookup