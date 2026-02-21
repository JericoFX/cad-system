# CAD System Refactoring Backlog

## Priority: High

### Performance Optimization

1. **Implement normalized state in cadStore**
   - Normalize persons, vehicles, records with ID-based lookup
   - Create entity selectors for efficient data access
   - Add relationship mapping for related entities
   - Estimated effort: 8 hours

2. **Add virtual scrolling to search components**
   - Implement createVirtualizer for PersonSearch results
   - Add virtual scrolling to VehicleSearch lists
   - Implement windowing for CaseManager evidence lists
   - Add loading skeletons for virtualized content
   - Estimated effort: 12 hours

3. **Implement batched updates for store actions**
   - Wrap related state changes in batch() calls
   - Optimize terminal command processing
   - Reduce re-renders during modal transitions
   - Estimated effort: 6 hours

### Error Handling

4. **Add error boundaries to ModalHost**
   - Implement ErrorBoundary component for modals
   - Add error fallback UI for crashed components
   - Implement error logging with context
   - Estimated effort: 4 hours

5. **Replace direct fetch calls with createResource**
   - Convert evidence loading to use createResource
   - Implement proper loading states with Suspense
   - Add error boundaries for resource failures
   - Estimated effort: 8 hours

## Priority: Medium

### Accessibility

6. **Add ARIA attributes to interactive components**
   - Implement proper ARIA roles for modal dialogs
   - Add ARIA labels for form fields in all modals
   - Add live regions for terminal output
   - Estimated effort: 6 hours

7. **Implement focus management in modals**
   - Add focus trapping in ModalHost
   - Implement focus restoration after modal close
   - Add keyboard navigation for tabs and lists
   - Estimated effort: 8 hours

### State Management

8. **Implement createSelector for complex state queries**
   - Add memoized selectors for frequently accessed data
   - Create composable selectors for derived state
   - Implement selector factories for parameterized queries
   - Estimated effort: 6 hours

9. **Add localStorage persistence for UI preferences**
   - Implement state serialization/deserialization
   - Add migration system for state schema changes
   - Create persistence hooks for critical state
   - Estimated effort: 6 hours

### Component Architecture

10. **Refactor components to use render props and slots**
    - Implement render props for customizable content areas
    - Add slot patterns for modal headers/footers
    - Create composable UI components with render props
    - Estimated effort: 10 hours

## Priority: Low

### Advanced Optimizations

11. **Implement advanced memoization strategies**
    - Add createMemo for expensive computations
    - Implement proper dependency tracking
    - Add memoization for formatting functions
    - Estimated effort: 6 hours

12. **Add state persistence for UI preferences**
    - Implement localStorage persistence
    - Add state serialization/deserialization
    - Create persistence hooks for critical state
    - Estimated effort: 6 hours

13. **Implement comprehensive type safety improvements**
    - Add strict typing for all props and state
    - Implement proper generic types for reusable components
    - Add type guards for runtime type checking
    - Estimated effort: 12 hours

14. **Add performance monitoring and optimization**
    - Implement performance tracking for critical operations
    - Add profiling tools for development
    - Create performance benchmarks
    - Estimated effort: 8 hours

## Technical Debt

15. **Organize components by feature/domain**
    - Reorganize file structure for better maintainability
    - Add proper component documentation
    - Create component composition guidelines
    - Estimated effort: 8 hours

16. **Organize stores by feature/domain**
    - Reorganize store structure for better maintainability
    - Add proper store documentation
    - Create store testing utilities
    - Estimated effort: 8 hours

17. **Extract duplicate code patterns into reusable components**
    - Analyze codebase for repeated UI patterns (form sections, action buttons, info panels)
    - Identify common modal layouts and extract to TerminalModalFrame
    - Create standardized Form components (FormSection, FormActions, InfoPanel)
    - Build shared hooks for terminal context and reader operations
    - Estimated effort: 12 hours

## Testing & Quality Assurance

17. **Add unit tests for store logic**
    - Implement tests for normalized state selectors
    - Add tests for batched update operations
    - Create test utilities for store actions
    - Estimated effort: 10 hours

18. **Implement component testing**
    - Add tests for UI components with Solid Testing Library
    - Create test utilities for modal components
    - Implement integration tests for critical user flows
    - Estimated effort: 12 hours

19. **Extract duplicate code patterns into reusable components**
    - Analyze codebase for repeated UI patterns (form sections, action buttons, info panels)
    - Identify common modal layouts and extract to TerminalModalFrame
    - Create standardized Form components (FormSection, FormActions, InfoPanel)
    - Build shared hooks for terminal context and reader operations
    - Estimated effort: 12 hours

## New Features

20. **Add photo support to Person Search results**
    - Allow officers to attach photos to persons in search results
    - Display photos alongside person details (name, DOB, ID)
    - Support for multiple photos per person
    - Integration with existing photo capture system
    - Estimated effort: 8 hours

21. **Add photo support to Vehicle Search results**
    - Allow officers to attach photos to vehicles in search results
    - Display vehicle photos alongside plate, make, model
    - Support for multiple angles/photos per vehicle
    - Integration with existing evidence system
    - Estimated effort: 8 hours

22. **Photo integration with BOLO system**
    - Display person/vehicle photos in BOLO alerts
    - Quick visual identification for officers
    - Photo synchronization across all BOLO views
    - Support for photo updates in active BOLOs
    - Estimated effort: 10 hours

23. **Photo management in search interfaces**
    - Add photo upload/attach button in PersonSearch modal
    - Add photo upload/attach button in VehicleSearch modal
    - Photo preview and gallery view in search results
    - Integration with locker system for photo storage
    - Estimated effort: 6 hours

## Total Estimated Effort: 194 hours

## Implementation Phases

### Phase 1: Critical Performance & State Management (Week 1-2)
- Tasks 1, 2, 3, 4, 5
- Estimated effort: 38 hours

### Phase 2: Accessibility & Error Handling (Week 3)
- Tasks 6, 7, 8, 9
- Estimated effort: 26 hours

### Phase 3: Component Architecture (Week 4)
- Tasks 10, 15, 16, 17, 19
- Estimated effort: 46 hours

### Phase 4: Advanced Optimizations (Week 5)
- Tasks 11, 12, 13, 14, 18
- Estimated effort: 44 hours

### Phase 5: Photo Integration Features (Week 6)
- Tasks 20, 21, 22, 23
- Estimated effort: 32 hours

## Dependencies

- Task 8 (createSelector) depends on Task 1 (normalized state)
- Task 10 (render props) depends on Task 15 (component organization)
- Task 16 (store organization) depends on Task 8 (selectors)
- Task 18 (testing) depends on Tasks 15 and 16 (organization)
- Task 19 (extract duplicate code) depends on Task 6 (ARIA attributes) and Task 10 (component architecture)
- Tasks 20-23 (photo features) depend on Task 19 (reusable components) and existing photo system

## Success Metrics

1. **Performance:** 30-50% reduction in re-renders
2. **Accessibility:** WCAG 2.1 AA compliance
3. **Reliability:** 50% reduction in error boundaries triggered
4. **Maintainability:** 25% reduction in code complexity metrics
5. **Developer Experience:** 40% improvement in development build times
6. **User Experience:** Photo support in 100% of person/vehicle searches and BOLOs
