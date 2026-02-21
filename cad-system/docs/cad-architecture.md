# CAD System Architecture

## Overview

The CAD (Computer Aided Dispatch) system is a comprehensive law enforcement and emergency services management tool for FiveM roleplay servers. It provides integrated dispatch, case management, forensics, and EMS services.

## Component Interaction Diagram

```mermaid
graph TD
    A[Player] --> B[Client UI]
    A --> C[In-Game Actions]
    
    B --> D[NUI Interface]
    D --> E[SolidJS Frontend]
    
    E --> F[Server Callbacks]
    F --> G[Business Logic]
    G --> H[Database]
    G --> I[State Management]
    
    I --> J[GlobalState Sync]
    J --> K[Other Players]
    
    C --> L[ox_target/ox_zones]
    L --> M[Terminal Access]
    M --> N[Topology System]
    
    N --> O[Terminal DB]
    N --> P[Reader DB]
    N --> Q[Locker DB]
    
    G --> R[Topology System]
    R --> S[Terminal Data]
    R --> T[Reader Data]
    R --> U[Locker Data]
    
    E --> V[Computer Context]
    V --> W[Active Terminal]
    W --> X[ID Reader]
    W --> Y[Evidence Locker]
    
    X --> Z[Virtual Container]
    Y --> Z
    
    Z --> H
    
    subgraph "Frontend"
        B
        D
        E
        V
        W
        X
        Y
    end
    
    subgraph "Backend"
        F
        G
        H
        I
        J
        N
        O
        P
        Q
        R
        S
        T
        U
        Z
    end
    
    subgraph "Real-time Sync"
        I
        J
        K
    end
    
    subgraph "Physical Interaction"
        A
        C
        L
        M
    end
```

## Key Workflows

### 1. Terminal Access Workflow

```mermaid
sequenceDiagram
    participant P as Player
    participant C as Client
    participant S as Server
    participant DB as Database
    
    P->>C: Approach terminal
    C->>C: Check proximity
    C->>S: Request topology data
    S->>DB: Query terminals/readers/lockers
    DB->>S: Return topology
    S->>C: Send topology snapshot
    C->>C: Determine nearest terminal
    P->>C: Open CAD UI
    C->>S: Get computer context
    S->>C: Return terminal context
    C->>P: Show CAD interface
```

### 2. ID Reader Workflow

```mermaid
sequenceDiagram
    participant P as Player
    participant C as Client
    participant S as Server
    participant VC as Virtual Container
    
    P->>C: Interact with reader
    C->>S: List documents
    S->>S: Check inventory
    S->>C: Return document list
    C->>P: Show selection dialog
    P->>C: Select document
    C->>S: Insert document
    S->>VC: Store in virtual container
    S->>S: Remove from inventory
    S->>C: Confirm insertion
    C->>P: Show success notification
```

### 3. Evidence Locker Workflow

```mermaid
sequenceDiagram
    participant P as Player
    participant C as Client
    participant S as Server
    participant VC as Virtual Container
    
    P->>C: Interact with locker
    C->>S: List locker contents
    S->>VC: Query virtual container
    VC->>S: Return slot data
    S->>C: Send locker contents
    C->>P: Show locker UI
    P->>C: Select action (store/pull)
    C->>S: Process action
    S->>VC: Update virtual container
    S->>S: Update staging area
    S->>C: Confirm operation
    C->>P: Show result notification
```

## Data Flow Architecture

### Terminal Context Flow

```mermaid
graph LR
    A[Player Position] --> B[Nearest Terminal]
    B --> C[Terminal Data]
    C --> D[Reader Info]
    C --> E[Locker Info]
    C --> F[Access Permissions]
    D --> G[Computer Context]
    E --> G
    F --> G
    G --> H[NUI Interface]
```

### Evidence Flow

```mermaid
graph LR
    A[Collect Evidence] --> B[Staging Area]
    B --> C[Virtual Container]
    C --> D[Case Attachment]
    D --> E[Chain of Custody]
    E --> F[Database Storage]
```

## Security Architecture

### Access Control Flow

```mermaid
graph TD
    A[Player Action] --> B[Job Check]
    B --> C[Terminal Permissions]
    C --> D[Reader Permissions]
    D --> E[Locker Permissions]
    E --> F[Allow/Deny Action]
    F --> G[Execute/Deny]
```

## System Components

### 1. Database Layer
- MySQL storage for persistent data
- Automatic schema management
- Regular cleanup events
- StateBag synchronization

### 2. Server Logic
- Topology management
- Virtual container system
- Evidence processing
- Dispatch operations
- Case management

### 3. Client Interface
- NUI with SolidJS frontend
- Terminal interaction zones
- Real-time state updates
- Notification system

### 4. Integration Points
- QBCore framework
- ox_lib utilities
- ox_inventory system
- ox_target zones

This architecture provides a robust, scalable system for law enforcement roleplay with comprehensive evidence handling and real-time coordination capabilities.
