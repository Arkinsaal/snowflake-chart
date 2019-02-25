// @flow
import React, { Component, Fragment } from 'react';

const { round, random, pow, max, cos, sin, acos, sqrt } = Math;

const stringifyOrdered = (obj) =>
  JSON.stringify(obj, Object.keys(obj).sort());

type Coords = {
  x: number,
  y: number,
}

type Vector = {
  x1: number,
  y1: number,
  x2: number,
  y2: number,
}

type NodeType = {
  id: string,
  title: string,
  options: {
    activeRadius: number,
    inactiveRadius: number,
  },
  active: boolean,
  nodes?: NodeType[]
}

type Collision = {
  endPoint: Coords,
  clockwise: Coords | boolean,
  anticlockwise: Coords | boolean,
  hasIntersect: boolean,
  node: NodeState,
  ancestor: NodeState,
}

type NodeProps = {
  node: NodeType,
  angle: number,
  startingAngle: number,
  parent: {
    getRadius: (void) => number,
  },
  absolutePosition: Coords,
  ancestors: any[],
  angleDifference: number,
}

type NodeState = {
  active: boolean,
  position: Coords,
  deactivateActions: Function[],
  distanceIncreases: {
    [string]: number,
  },
  collisions: Collision[],
}

const debugging = true;

const minLineDistance: number = 120;
const activeRadius: number = 80;
const inactiveRadius: number = 20;

const dot = (a: Coords, b: Coords) => (a.x * b.x) + (a.y * b.y);
const magnitude = (a: Coords) => Math.sqrt(pow(a.x, 2) + pow(a.y, 2));

function intersect(
  { x1: lx1, y1: ly1, x2: lx2, y2: ly2 }: Vector,
  { x1: vx1, y1: vy1, x2: vx2, y2: vy2 }: Vector
): { x: number, y: number } | boolean {
  // Check if none of the lines are of length 0
  if ((lx1 === lx2 && ly1 === ly2) || (vx1 === vx2 && vy1 === vy2)) return false;

  // essentially the angle between lines
  const denominator: number = ((vy2 - vy1) * (lx2 - lx1) - (vx2 - vx1) * (ly2 - ly1));

  // Lines are considered parallel
  if (denominator > -0.001 && denominator < 0.001) return false;

  // does the vector intersect the line?
  const ua: number = ((vx2 - vx1) * (ly1 - vy1) - (vy2 - vy1) * (lx1 - vx1)) / denominator;
  // const ub: number = ((lx2 - lx1) * (ly1 - vy1) - (ly2 - ly1) * (lx1 - vx1)) / denominator;

  // is the intersection along the segments
  if (ua < 0.001 || ua > 0.999) return false;

  return {
    x: lx1 + ua * (lx2 - lx1),
    y: ly1 + ua * (ly2 - ly1),
  };
}

class Line {
  point1: Coords;
  point2: Coords;

  x1: number;
  y1: number;
  x2: number;
  y2: number;

  constructor(point1: Coords, point2: Coords) {
    this.point1 = point1;
    this.point2 = point2;

    this.setup();
  }

  setup() {
    this.x1 = this.point1.x;
    this.y1 = this.point1.y;
    this.x2 = this.point2.x;
    this.y2 = this.point2.y;
  }

  magnitude() {

  }

  move(offset: Coords) {
    this.point1 = new Point(this.point1).move(offset);
    this.point2 = new Point(this.point2).move(offset);

    this.setup();

    return this;
  }

  angleBetween = () => acos(dot(this.point1, this.point2) / (magnitude(this.point1) * magnitude(this.point2))) * (180 / Math.PI);

  serialize = () => ['x1', 'y1', 'x2', 'y2'].reduce((o, p) => ({ ...o, [p]: this[p] }), {});
}

class Point {
  x: number;
  y: number;

  constructor({ x, y }: Coords = { x: 0, y: 0 }) {
    this.x = x;
    this.y = y;
  }

  move({ x, y }: Coords) {
    return new Point({
      x: this.x + x,
      y: this.y + y,
    });
  }

  add({ x, y }: Coords) {
    this.x += x;
    this.y += y;

    return this;
  }

  subtract({ x, y }: Coords) {
    this.x -= x;
    this.y -= y;

    return this;
  }

  negative() {
    return new Point({
      x: -this.x,
      y: -this.y,
    });
  }

  lineTo(point) {
    return new Line(this, point);
  }

  distanceFromOrigin = () => sqrt(pow(this.x, 2) + pow(this.y, 2));

  serialize() {
    return {
      x1: 0,
      y1: 0,
      x2: this.x,
      y2: this.y,
    };
  }
}





























// -------------------------------------------------------------------------------
// draws nodes and manages positions
class Node extends Component<NodeProps, NodeState> {

  state = {
    active: this.props.node.active,
    distanceIncreases: {},
    position: {
      x: 0,
      y: 0,
    },
    collisions: [],
    deactivateActions: {},
  }

  componentWillUnmount() {
    console.log(this.props.node.id);
    console.log(this.state.deactivateActions);
    Object.values(this.state.deactivateActions).forEach((action) => {
      action();
    });
  }

  componentDidUpdate(oldProps, oldState) {
    // run collision checks
    const { absolutePosition } = this.props;
    const { distanceIncreases, active } = this.state;

    if (oldState.active && !active) {
      console.log('blah1', this.props.node.id);
      Object.values(this.state.deactivateActions).forEach((action) => {
        action();
      });
      return;
    }

    if (
      stringifyOrdered(oldState.distanceIncreases) !== stringifyOrdered(distanceIncreases)
      || stringifyOrdered(oldProps.absolutePosition) !== stringifyOrdered(absolutePosition)
      || (!oldState.active && active)
    ) {
      console.log('blah2', this.props.node.id);
      this.runCollisionChecks();
    }
  }

  getRadius: (void) => number = () => this.state.active ? this.props.node.options.activeRadius : this.props.node.options.inactiveRadius;

  toggleActive = (active = !this.state.active) => {
    this.setState({
      active,
    });
  }

  clearDistance = (id) => {
    this.setState({
      distanceIncreases: JSON.parse(JSON.stringify({
        ...this.state.distanceIncreases,
        [id]: undefined,
      })),
    }, () => {
      //console.log(this.state.distanceIncreases);
    });
  }

  removeOnDeactivate = (id, action) => {
    this.setState({
      deactivateActions: {
        ...this.state.deactivateActions,
        [id]: action,
      },
    }, () => {
      //console.log(this.state.deactivateActions);
    });
  }

  runCollisionChecks() {
    const collisions = this.getCollisions().filter(({ hasIntersect }) => hasIntersect);

    const lastCollision = collisions[collisions.length - 1];
    if (lastCollision) {
      const executeNext = () => lastCollision.ancestor.updatePosition(lastCollision);

      executeNext();
    }
  }

  getCollisions = () => {
    const { ancestors = [], absolutePosition = { x: 0, y: 0 } } = this.props;
    const offset = this.getOffset();
    const { x, y } = offset;

    const start = new Point();

    return ancestors.map((ancestor) => {
      const { props: { absolutePosition: abs = { x: 0, y: 0 } }, getNodeBoundaries, getOffset } = ancestor;
      const [clockwise, anticlockwise] = getNodeBoundaries();
      const ancestorOffset = getOffset();

      const endPoint = new Point({
        x: -((absolutePosition.x + x) - (abs.x + ancestorOffset.x)),
        y: -((absolutePosition.y + y) - (abs.y + ancestorOffset.y)),
      });

      const lineAbsolute = new Line(start, endPoint);
      const absoluteOffset = new Point(absolutePosition).subtract(abs);

      const clockwiseAbsolute = clockwise
        .move(offset.negative())
        .move(absoluteOffset.negative())
        .move(ancestorOffset);
      const anticlockwiseAbsolute = anticlockwise
        .move(offset.negative())
        .move(absoluteOffset.negative())
        .move(ancestorOffset);

      const clockwiseIntersect = intersect(
        lineAbsolute,
        clockwiseAbsolute
      );
      const anticlockwiseIntersect = intersect(
        lineAbsolute,
        anticlockwiseAbsolute
      );

      return {
        endPoint,
        line: lineAbsolute,
        intersectionData: {
          line: lineAbsolute,
          clockwise: clockwiseIntersect && clockwiseAbsolute,
          anticlockwise: anticlockwiseIntersect && anticlockwiseAbsolute,
        },
        clockwise: clockwiseIntersect,
        anticlockwise: anticlockwiseIntersect,
        hasIntersect: clockwiseIntersect !== false || anticlockwiseIntersect !== false,
        intersect: clockwiseIntersect || anticlockwiseIntersect,
        node: this,
        ancestor,
      };
    });
  }

  updatePosition = (collisionData) => {
    const { intersectionData } = collisionData;

    const intersectedLine = intersectionData.line;
    const intersectingVector = intersectionData.clockwise || intersectionData.anticlockwise;
    const intersectingVectorFromZero = {
      x: intersectingVector.x2 - intersectingVector.x1,
      y: intersectingVector.y2 - intersectingVector.y1,
    };

    const angleOfIntersection = 180 - acos(dot(intersectedLine.point2, intersectingVectorFromZero) / (magnitude(intersectedLine.point2) * magnitude(intersectingVectorFromZero))) * (180 / Math.PI);
    const a2 = collisionData.ancestor.props.angleDifference / 2;

    const distance = Math.abs(((magnitude(intersectedLine.point2)) / Math.sin(a2 * 0.0174533)) * Math.sin(angleOfIntersection * 0.0174533));

    const distanceId = `${collisionData.node.props.node.id}_${collisionData.ancestor.props.node.id}`;

    this.setState({
      distanceIncreases: {
        ...this.state.distanceIncreases,
        [distanceId]: distance,
      },
    }, () => {
      collisionData.node.removeOnDeactivate(distanceId, this.clearDistance.bind(this, distanceId));
    });
  }

  getNodeBoundaries = (dist = 10) => {
    const { angleDifference, startingAngle = 0 } = this.props;

    const diff = angleDifference / 2;

    const angle = startingAngle + this.props.angle;

    const offset = this.getOffset();

    return [
      new Point(offset.negative()).lineTo({
        x: (cos((angle + diff) * 0.0174533) * dist) - offset.x,
        y: (sin((angle + diff) * 0.0174533) * dist) - offset.y,
      }),
      new Point(offset.negative()).lineTo({
        x: (cos((angle - diff) * 0.0174533) * dist) - offset.x,
        y: (sin((angle - diff) * 0.0174533) * dist) - offset.y,
      })
    ];
  }

  getOffset = () => {
    const { parent, angle, startingAngle = 0 } = this.props;
    const { active, distanceIncreases } = this.state;

    if (!parent) return new Point();

    const offsetDistance: number = max(...Object.values(distanceIncreases), minLineDistance);

    const dist: number = this.getRadius() + parent.getRadius() + (active ? offsetDistance : -this.getRadius());

    return new Point({
      x: cos((startingAngle + angle) * 0.0174533) * dist,
      y: sin((startingAngle + angle) * 0.0174533) * dist,
    });
  }

  render() {
    const { node, angle, ancestors, startingAngle = 0, absolutePosition = { x: 0, y: 0 }, children } = this.props;
    const { active } = this.state;

    const radius = this.getRadius();
    const offset = this.getOffset();
    const guideLine = new Point().lineTo(offset.negative());

    return (
      <g
        className={`transition ${node.active ? 'active' : ''}`}
        transform={`translate(${offset.x} ${offset.y})`}
      >

        { debugging && (
          <DebuggingLines
            boundaries={this.getNodeBoundaries(1000)}
            collisions={this.getCollisions()}
          />
        ) }

        { <line
          {...guideLine.serialize()}
          style={{
            stroke: 'rgba(255,255,255,0.25)',
            strokeWidth: 2
          }}
        /> }

        { children({
          id: node.id,
          active,
          radius,
        }, this.toggleActive) }

        { active && <g>
          {(node.nodes || []).map((n, i, arr) => (
            <Node
              key={n.id}
              node={n}
              parent={this}
              ancestors={[...ancestors, this]}
              startingAngle={(startingAngle + 180 + angle) % 360}
              angleDifference={360 / (arr.length + 1)}
              angle={((360 / (arr.length + 1))) * (i + 1)}
              absolutePosition={new Point(absolutePosition).move(offset)}
            >
              { children }
            </Node>
          ))}
        </g> }

      </g>
    );
  }
}
// -------------------------------------------------------------------------------

































// -------------------------------------------------------------------------------
// Debugging only
const boundaryStyle = { stroke: 'rgba(255,255,255,0.3)', strokeWidth: 2 };
const collisionStyle = (hasIntersect) => ({ stroke: hasIntersect ? 'rgba(255,100,100,0.5)' : 'rgba(100,255,100,0.5)', strokeWidth: 2 });

function DebuggingLines({ boundaries = [], collisions = [] }) {
  return (
    <Fragment>
      { boundaries.map((boundary, i) =>
        <line {...boundary.serialize()} key={i} style={boundaryStyle} />
      ) }

      { collisions.map(({ line, hasIntersect, intersectionData, clockwise, anticlockwise }, i) => hasIntersect && (
        <g key={i}>
          <line {...intersectionData.line.serialize()} style={collisionStyle(hasIntersect)} />
          { clockwise && <line {...intersectionData.clockwise.serialize()} style={collisionStyle(true)} /> }
          { anticlockwise && <line {...intersectionData.anticlockwise.serialize()} style={collisionStyle(true)} /> }
        </g>
      )) }
    </Fragment>
  );
}
// -------------------------------------------------------------------------------

















// Tree should hold the details of distanceIncreases
/*
  tree = {
    [nodeId]: {
      increases: {
        [nodeId]: 12,
      },
      nodes: {
        [nodeId]: {

        }
        increases: {
          [nodeId]: 67
        }
      }
    }
  }
*/
















// -------------------------------------------------------------------------------
// handle dragging functionality and render first node
type TreeProps = {
  tree: NodeType,
}

type TreeState = {
  dragging: boolean,
  xOffset: number,
  yOffset: number,
  lastX: number,
  lastY: number,
}

class SnowflakeNavigation extends Component<TreeProps, TreeState> {

  state = {
    dragging: false,
    xOffset: 0,
    yOffset: 0,
    lastX: 0,
    lastY: 0,
  }

  focusPoint = ({ x, y }: Coords) => {
    this.setState({
      xOffset: x,
      yOffset: y,
    });
  }

  mouseMove = (e: { clientX: number, clientY: number }) => {
    const { dragging, xOffset, yOffset, lastX, lastY } = this.state;

    if (dragging) {
      this.setState({
        xOffset: xOffset + ((lastX - e.clientX) * 4),
        yOffset: yOffset + ((lastY - e.clientY) * 4),
        lastX: e.clientX,
        lastY: e.clientY,
      });
    }
  };

  mouseUp = () => {
    this.setState({
      dragging: false,
    });
  };

  mouseDown = (e: { clientX: number, clientY: number }) => {
    this.setState({
      lastX: e.clientX,
      lastY: e.clientY,
      dragging: true,
    });
  };

  render() {
    const { tree, children } = this.props;
    const { xOffset, yOffset } = this.state;

    return (
      <div
        className="h100p w100p absolute top-0 left-0"
        onMouseDown={this.mouseDown}
        onMouseMove={this.mouseMove}
        onMouseLeave={this.mouseUp}
        onMouseUp={this.mouseUp}
      >
        <svg viewBox="-1000 -1000 2000 2000" width="100%" height="100%">
          <g transform={`translate(${-xOffset} ${-yOffset})`}>

            { children({
              radius: 80,
              active: true,
            }) }

            {(tree.nodes || []).map((n, i, arr) => (
              <Node
                key={n.id}
                node={n}
                parent={{
                  getRadius: () => activeRadius
                }}
                ancestors={[]}
                startingAngle={0}
                angleDifference={360 / arr.length}
                angle={((360 / arr.length)) * i}
                absolutePosition={new Point()}
              >
                { children }
              </Node>
            ))}
          </g>
        </svg>
      </div>
    );
  }
}
// -------------------------------------------------------------------------------



































// -------------------------------------------------------------------------------
// generates the tree
import { getNewGuid } from 'Services/helpers';

const getItem = (depth = 0, count = 5) => {
  const items = new Array(round(random() * count)).fill(null);

  return {
    id: getNewGuid(),
    title: '',
    options: {
      activeRadius,
      inactiveRadius,
    },
    active: false,
    ...(depth > 3 ? {} : {
      nodes: items.map(() => getItem(depth + 1)),
    }),
  };
};
// -------------------------------------------------------------------------------





































// -------------------------------------------------------------------------------
// This should the be the only thing a user needs
//const tree = getItem();

const tree = {"id":"e835ca06-31e9-4f06-a2c0-eb0e0d38c5fb","title":"SystemView","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"9fbeb59e-1f0a-4058-fa83-905eb29a6e9e","title":"Domains","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"0fcfa7cc-f093-4fde-8b75-27d3008adc9b","title":"Outpatients","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"ce4fd13f-2515-4c24-9369-06ce1c86d6cb","title":"Waiting List","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"4c36dba4-4977-4aa0-b9f9-0733e70da593","title":"Risks & Projections","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"f6d07979-fa41-4c51-cf4e-4b23a826bfee","title":"Trends","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"79b0af66-49cc-4e88-d697-12fe44ef28d4","title":"Dynamics","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"1f8e7e26-0dc3-4ffc-a715-4655889b9408","title":"Overview","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"e8e3aee4-b0e1-4929-d467-ecb21377a406","title":"Example Panel","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"dff92fff-f51d-4f1a-8569-944b8fe3836d","title":"Referral Management","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"e59014c2-c1c0-434a-a3f4-533c18182a14","title":"Uncategorised Referrals","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"ab3d3f13-b7db-42af-8189-b1d1bf33f98d","title":"Demand & Activity","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"c97ca25f-657e-4b3a-a71a-a1b472a9dc83","title":"Bookings","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"8be71824-fa68-40f2-b27f-9627b0a2d01c","title":"Future Booked Appointments","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"ca86c71f-6fc1-4451-b77b-525937dc5f43","title":"Future Booked Appointments by Wait Status","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"47f86c04-292d-4581-d91d-85d49ceef71a","title":"Chronological Management","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"31e8144c-f0ec-4c70-898e-bfc2f52b446d","title":"Wait Times","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"d42b1e8e-936e-4020-d224-9d3ee5404bf7","title":"Reviews","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"a5b1e9d9-6931-4cfc-8363-5070de9ef6a1","title":"Future Booked Reviews","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"1dceceb0-3a69-4bd5-ac71-8c346d95b395","title":"High Frequency Reviews","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"677868dd-c34c-44b1-d5c6-f36c11a61e1b","title":"Clinic Effectiveness","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"074b8231-89cd-4676-9696-4db4933666a5","title":"New & Review Appointments","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"5bf97038-a113-443d-a9c2-256da5f7d79d","title":"New Appointments Not From The Waiting List","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"b98507ec-4062-4726-f572-472cb7bcf77f","title":"FTAs","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"10d224bd-e47c-4d06-cb2d-027543a7b638","title":"Cancellations","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"73689b88-f95f-401a-9128-964e8b0d3987","title":"Discharges","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"78ec1e47-7159-45d9-aff8-ec270a2149c6","title":"Review Appointment Generations","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"43d181e6-8a6c-41b2-ecd0-d4d55fe12139","title":"Conversions to Elective Surgery","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]}]},{"id":"826c5ef8-860b-40dc-a22b-f2cbd17db2c1","title":"Surgery","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"b51269cc-be9a-451e-86e9-09931040abbf","title":"Waiting List","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"23ea3acf-61cb-4680-b7b3-437e8f2a5ab6","title":"Trends","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"95005174-6627-41c7-a267-39039d593b2c","title":"Risks & Projections","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"1b710e2a-39e2-4427-8d7f-36ca916baaf1","title":"End of Month","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"b4f90491-da57-484a-82e1-78c816c2c307","title":"Dynamics","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"8b958ba0-37c0-45b7-f1cb-c3dbf0bc0f68","title":"Procedure Analysis","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"960272a2-d275-4631-a5b4-e4960e6b1f41","title":"Demand & Capacity","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"6f74a43f-68bb-4b5a-fec2-92170f6e3bfd","title":"Emergency Session Allocation","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"e9192861-7eb1-46b4-e70e-9315f2053367","title":"Emergency Operations in Elective Sessions","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"21576ca2-36d0-44ce-c7bf-d20953721388","title":"Elective Schedule Monitor","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"c03e5dfd-f636-45ae-a540-c369bcadf005","title":"Theatre Effectiveness","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"ffb83e86-d576-4715-e55f-01025b12738f","title":"Utilisation","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"c561da44-857f-4655-8fe7-66257f681a67","title":"Late Starts","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"40cfbdf6-38e8-4250-82b5-442b9e6c0071","title":"Early Finishes","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"fbc4ffaf-61a5-4175-ebce-d573f34b9e3b","title":"Late Finishes","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"bffee1e8-d200-4950-a988-001b9df9d3ac","title":"Chronological Management","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"4422ce5a-a1ac-407c-a071-d50dd5e922b7","title":"Treat in Turn","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"d2fb1e3c-4576-4bbf-b911-f33a9acccf89","title":"Booking Auditor","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"a30fc0dd-4361-4e2a-be75-1a91af667fad","title":"Recent Bookings Auditor","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"0cc9fd9d-543c-4163-9f1e-66944fe8cee4","title":"Wait Times","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]}]},{"id":"74d7ece5-992b-40a5-f70e-63d1ba9da6eb","title":"Emergency Department","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"48ed3ba8-c471-4637-8a5c-44933da658f5","title":"Coming Soon","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[]}]},{"id":"27d909b1-a25d-4fad-9d8e-c288951e6da0","title":"Beds","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[]}]},{"id":"e09376e9-1c08-4ec3-f836-40a25a0d1e70","title":"Teams","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"dcc3ac8e-0c7c-4fc8-ca20-10071e90884f","title":"ALLIED HEALTH OTHER","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"0fcfa7cc-f093-4fde-8b75-27d3008adc9b","title":"Outpatients","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"ce4fd13f-2515-4c24-9369-06ce1c86d6cb","title":"Waiting List","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"4c36dba4-4977-4aa0-b9f9-0733e70da593","title":"Risks & Projections","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"f6d07979-fa41-4c51-cf4e-4b23a826bfee","title":"Trends","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"79b0af66-49cc-4e88-d697-12fe44ef28d4","title":"Dynamics","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"1f8e7e26-0dc3-4ffc-a715-4655889b9408","title":"Overview","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"e8e3aee4-b0e1-4929-d467-ecb21377a406","title":"Example Panel","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"dff92fff-f51d-4f1a-8569-944b8fe3836d","title":"Referral Management","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"e59014c2-c1c0-434a-a3f4-533c18182a14","title":"Uncategorised Referrals","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"ab3d3f13-b7db-42af-8189-b1d1bf33f98d","title":"Demand & Activity","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"c97ca25f-657e-4b3a-a71a-a1b472a9dc83","title":"Bookings","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"8be71824-fa68-40f2-b27f-9627b0a2d01c","title":"Future Booked Appointments","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"ca86c71f-6fc1-4451-b77b-525937dc5f43","title":"Future Booked Appointments by Wait Status","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"47f86c04-292d-4581-d91d-85d49ceef71a","title":"Chronological Management","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"31e8144c-f0ec-4c70-898e-bfc2f52b446d","title":"Wait Times","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"d42b1e8e-936e-4020-d224-9d3ee5404bf7","title":"Reviews","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"a5b1e9d9-6931-4cfc-8363-5070de9ef6a1","title":"Future Booked Reviews","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"1dceceb0-3a69-4bd5-ac71-8c346d95b395","title":"High Frequency Reviews","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"677868dd-c34c-44b1-d5c6-f36c11a61e1b","title":"Clinic Effectiveness","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"074b8231-89cd-4676-9696-4db4933666a5","title":"New & Review Appointments","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"5bf97038-a113-443d-a9c2-256da5f7d79d","title":"New Appointments Not From The Waiting List","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"b98507ec-4062-4726-f572-472cb7bcf77f","title":"FTAs","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"10d224bd-e47c-4d06-cb2d-027543a7b638","title":"Cancellations","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"73689b88-f95f-401a-9128-964e8b0d3987","title":"Discharges","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"78ec1e47-7159-45d9-aff8-ec270a2149c6","title":"Review Appointment Generations","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"43d181e6-8a6c-41b2-ecd0-d4d55fe12139","title":"Conversions to Elective Surgery","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]}]},{"id":"826c5ef8-860b-40dc-a22b-f2cbd17db2c1","title":"Surgery","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"b51269cc-be9a-451e-86e9-09931040abbf","title":"Waiting List","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"23ea3acf-61cb-4680-b7b3-437e8f2a5ab6","title":"Trends","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"95005174-6627-41c7-a267-39039d593b2c","title":"Risks & Projections","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"1b710e2a-39e2-4427-8d7f-36ca916baaf1","title":"End of Month","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"b4f90491-da57-484a-82e1-78c816c2c307","title":"Dynamics","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"8b958ba0-37c0-45b7-f1cb-c3dbf0bc0f68","title":"Procedure Analysis","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"960272a2-d275-4631-a5b4-e4960e6b1f41","title":"Demand & Capacity","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"6f74a43f-68bb-4b5a-fec2-92170f6e3bfd","title":"Emergency Session Allocation","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"e9192861-7eb1-46b4-e70e-9315f2053367","title":"Emergency Operations in Elective Sessions","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"21576ca2-36d0-44ce-c7bf-d20953721388","title":"Elective Schedule Monitor","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"c03e5dfd-f636-45ae-a540-c369bcadf005","title":"Theatre Effectiveness","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"ffb83e86-d576-4715-e55f-01025b12738f","title":"Utilisation","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"c561da44-857f-4655-8fe7-66257f681a67","title":"Late Starts","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"40cfbdf6-38e8-4250-82b5-442b9e6c0071","title":"Early Finishes","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"fbc4ffaf-61a5-4175-ebce-d573f34b9e3b","title":"Late Finishes","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"bffee1e8-d200-4950-a988-001b9df9d3ac","title":"Chronological Management","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"4422ce5a-a1ac-407c-a071-d50dd5e922b7","title":"Treat in Turn","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"d2fb1e3c-4576-4bbf-b911-f33a9acccf89","title":"Booking Auditor","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"a30fc0dd-4361-4e2a-be75-1a91af667fad","title":"Recent Bookings Auditor","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"0cc9fd9d-543c-4163-9f1e-66944fe8cee4","title":"Wait Times","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]}]},{"id":"74d7ece5-992b-40a5-f70e-63d1ba9da6eb","title":"Emergency Department","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"48ed3ba8-c471-4637-8a5c-44933da658f5","title":"Coming Soon","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[]}]},{"id":"27d909b1-a25d-4fad-9d8e-c288951e6da0","title":"Beds","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[]}]},{"id":"7f97070c-7ae2-48fd-e800-f9d9436080b9","title":"CARDIO THORACIC","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"0fcfa7cc-f093-4fde-8b75-27d3008adc9b","title":"Outpatients","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"ce4fd13f-2515-4c24-9369-06ce1c86d6cb","title":"Waiting List","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"4c36dba4-4977-4aa0-b9f9-0733e70da593","title":"Risks & Projections","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"f6d07979-fa41-4c51-cf4e-4b23a826bfee","title":"Trends","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"79b0af66-49cc-4e88-d697-12fe44ef28d4","title":"Dynamics","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"1f8e7e26-0dc3-4ffc-a715-4655889b9408","title":"Overview","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"e8e3aee4-b0e1-4929-d467-ecb21377a406","title":"Example Panel","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"dff92fff-f51d-4f1a-8569-944b8fe3836d","title":"Referral Management","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"e59014c2-c1c0-434a-a3f4-533c18182a14","title":"Uncategorised Referrals","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"ab3d3f13-b7db-42af-8189-b1d1bf33f98d","title":"Demand & Activity","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"c97ca25f-657e-4b3a-a71a-a1b472a9dc83","title":"Bookings","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"8be71824-fa68-40f2-b27f-9627b0a2d01c","title":"Future Booked Appointments","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"ca86c71f-6fc1-4451-b77b-525937dc5f43","title":"Future Booked Appointments by Wait Status","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"47f86c04-292d-4581-d91d-85d49ceef71a","title":"Chronological Management","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"31e8144c-f0ec-4c70-898e-bfc2f52b446d","title":"Wait Times","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"d42b1e8e-936e-4020-d224-9d3ee5404bf7","title":"Reviews","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"a5b1e9d9-6931-4cfc-8363-5070de9ef6a1","title":"Future Booked Reviews","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"1dceceb0-3a69-4bd5-ac71-8c346d95b395","title":"High Frequency Reviews","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"677868dd-c34c-44b1-d5c6-f36c11a61e1b","title":"Clinic Effectiveness","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"074b8231-89cd-4676-9696-4db4933666a5","title":"New & Review Appointments","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"5bf97038-a113-443d-a9c2-256da5f7d79d","title":"New Appointments Not From The Waiting List","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"b98507ec-4062-4726-f572-472cb7bcf77f","title":"FTAs","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"10d224bd-e47c-4d06-cb2d-027543a7b638","title":"Cancellations","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"73689b88-f95f-401a-9128-964e8b0d3987","title":"Discharges","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"78ec1e47-7159-45d9-aff8-ec270a2149c6","title":"Review Appointment Generations","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"43d181e6-8a6c-41b2-ecd0-d4d55fe12139","title":"Conversions to Elective Surgery","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]}]},{"id":"826c5ef8-860b-40dc-a22b-f2cbd17db2c1","title":"Surgery","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"b51269cc-be9a-451e-86e9-09931040abbf","title":"Waiting List","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"23ea3acf-61cb-4680-b7b3-437e8f2a5ab6","title":"Trends","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"95005174-6627-41c7-a267-39039d593b2c","title":"Risks & Projections","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"1b710e2a-39e2-4427-8d7f-36ca916baaf1","title":"End of Month","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"b4f90491-da57-484a-82e1-78c816c2c307","title":"Dynamics","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"8b958ba0-37c0-45b7-f1cb-c3dbf0bc0f68","title":"Procedure Analysis","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"960272a2-d275-4631-a5b4-e4960e6b1f41","title":"Demand & Capacity","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"6f74a43f-68bb-4b5a-fec2-92170f6e3bfd","title":"Emergency Session Allocation","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"e9192861-7eb1-46b4-e70e-9315f2053367","title":"Emergency Operations in Elective Sessions","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"21576ca2-36d0-44ce-c7bf-d20953721388","title":"Elective Schedule Monitor","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"c03e5dfd-f636-45ae-a540-c369bcadf005","title":"Theatre Effectiveness","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"ffb83e86-d576-4715-e55f-01025b12738f","title":"Utilisation","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"c561da44-857f-4655-8fe7-66257f681a67","title":"Late Starts","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"40cfbdf6-38e8-4250-82b5-442b9e6c0071","title":"Early Finishes","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"fbc4ffaf-61a5-4175-ebce-d573f34b9e3b","title":"Late Finishes","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"bffee1e8-d200-4950-a988-001b9df9d3ac","title":"Chronological Management","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"4422ce5a-a1ac-407c-a071-d50dd5e922b7","title":"Treat in Turn","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"d2fb1e3c-4576-4bbf-b911-f33a9acccf89","title":"Booking Auditor","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"a30fc0dd-4361-4e2a-be75-1a91af667fad","title":"Recent Bookings Auditor","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"0cc9fd9d-543c-4163-9f1e-66944fe8cee4","title":"Wait Times","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]}]},{"id":"74d7ece5-992b-40a5-f70e-63d1ba9da6eb","title":"Emergency Department","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"48ed3ba8-c471-4637-8a5c-44933da658f5","title":"Coming Soon","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[]}]},{"id":"27d909b1-a25d-4fad-9d8e-c288951e6da0","title":"Beds","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[]}]},{"id":"d3205d90-847f-4395-fc73-315fd50d63a7","title":"DERMATOLOGY","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"0fcfa7cc-f093-4fde-8b75-27d3008adc9b","title":"Outpatients","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"ce4fd13f-2515-4c24-9369-06ce1c86d6cb","title":"Waiting List","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"4c36dba4-4977-4aa0-b9f9-0733e70da593","title":"Risks & Projections","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"f6d07979-fa41-4c51-cf4e-4b23a826bfee","title":"Trends","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"79b0af66-49cc-4e88-d697-12fe44ef28d4","title":"Dynamics","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"1f8e7e26-0dc3-4ffc-a715-4655889b9408","title":"Overview","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"e8e3aee4-b0e1-4929-d467-ecb21377a406","title":"Example Panel","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"dff92fff-f51d-4f1a-8569-944b8fe3836d","title":"Referral Management","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"e59014c2-c1c0-434a-a3f4-533c18182a14","title":"Uncategorised Referrals","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"ab3d3f13-b7db-42af-8189-b1d1bf33f98d","title":"Demand & Activity","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"c97ca25f-657e-4b3a-a71a-a1b472a9dc83","title":"Bookings","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"8be71824-fa68-40f2-b27f-9627b0a2d01c","title":"Future Booked Appointments","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"ca86c71f-6fc1-4451-b77b-525937dc5f43","title":"Future Booked Appointments by Wait Status","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"47f86c04-292d-4581-d91d-85d49ceef71a","title":"Chronological Management","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"31e8144c-f0ec-4c70-898e-bfc2f52b446d","title":"Wait Times","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"d42b1e8e-936e-4020-d224-9d3ee5404bf7","title":"Reviews","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"a5b1e9d9-6931-4cfc-8363-5070de9ef6a1","title":"Future Booked Reviews","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"1dceceb0-3a69-4bd5-ac71-8c346d95b395","title":"High Frequency Reviews","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"677868dd-c34c-44b1-d5c6-f36c11a61e1b","title":"Clinic Effectiveness","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"074b8231-89cd-4676-9696-4db4933666a5","title":"New & Review Appointments","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"5bf97038-a113-443d-a9c2-256da5f7d79d","title":"New Appointments Not From The Waiting List","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"b98507ec-4062-4726-f572-472cb7bcf77f","title":"FTAs","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"10d224bd-e47c-4d06-cb2d-027543a7b638","title":"Cancellations","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"73689b88-f95f-401a-9128-964e8b0d3987","title":"Discharges","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"78ec1e47-7159-45d9-aff8-ec270a2149c6","title":"Review Appointment Generations","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"43d181e6-8a6c-41b2-ecd0-d4d55fe12139","title":"Conversions to Elective Surgery","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]}]},{"id":"826c5ef8-860b-40dc-a22b-f2cbd17db2c1","title":"Surgery","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"b51269cc-be9a-451e-86e9-09931040abbf","title":"Waiting List","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"23ea3acf-61cb-4680-b7b3-437e8f2a5ab6","title":"Trends","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"95005174-6627-41c7-a267-39039d593b2c","title":"Risks & Projections","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"1b710e2a-39e2-4427-8d7f-36ca916baaf1","title":"End of Month","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"b4f90491-da57-484a-82e1-78c816c2c307","title":"Dynamics","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"8b958ba0-37c0-45b7-f1cb-c3dbf0bc0f68","title":"Procedure Analysis","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"960272a2-d275-4631-a5b4-e4960e6b1f41","title":"Demand & Capacity","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"6f74a43f-68bb-4b5a-fec2-92170f6e3bfd","title":"Emergency Session Allocation","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"e9192861-7eb1-46b4-e70e-9315f2053367","title":"Emergency Operations in Elective Sessions","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"21576ca2-36d0-44ce-c7bf-d20953721388","title":"Elective Schedule Monitor","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"c03e5dfd-f636-45ae-a540-c369bcadf005","title":"Theatre Effectiveness","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"ffb83e86-d576-4715-e55f-01025b12738f","title":"Utilisation","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"c561da44-857f-4655-8fe7-66257f681a67","title":"Late Starts","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"40cfbdf6-38e8-4250-82b5-442b9e6c0071","title":"Early Finishes","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"fbc4ffaf-61a5-4175-ebce-d573f34b9e3b","title":"Late Finishes","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]},{"id":"bffee1e8-d200-4950-a988-001b9df9d3ac","title":"Chronological Management","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"4422ce5a-a1ac-407c-a071-d50dd5e922b7","title":"Treat in Turn","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"d2fb1e3c-4576-4bbf-b911-f33a9acccf89","title":"Booking Auditor","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"a30fc0dd-4361-4e2a-be75-1a91af667fad","title":"Recent Bookings Auditor","options":{"activeRadius":80,"inactiveRadius":20},"active":false},{"id":"0cc9fd9d-543c-4163-9f1e-66944fe8cee4","title":"Wait Times","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]}]},{"id":"74d7ece5-992b-40a5-f70e-63d1ba9da6eb","title":"Emergency Department","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[{"id":"48ed3ba8-c471-4637-8a5c-44933da658f5","title":"Coming Soon","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[]}]},{"id":"27d909b1-a25d-4fad-9d8e-c288951e6da0","title":"Beds","options":{"activeRadius":80,"inactiveRadius":20},"active":false,"nodes":[]}]},{"id":"add-new-petal","title":"Add a specialty","options":{"activeRadius":80,"inactiveRadius":20},"active":false}]}]}

export default function SnowflakeTest() {
  return (
    <SnowflakeNavigation
      tree={tree}
      minimumSeparation={120}
    >
      {(node, toggleActive) => (
        <circle
          className="transition"
          onClick={() => toggleActive()} r={node.radius} cx={0} cy={0} style={{
            fill: '#232833',
            stroke: 'black',
            strokeWidth: '3px',
            zIndex: 2,
            position: 'relative',
          }}
        />
      )}
    </SnowflakeNavigation>
  );
}
// -------------------------------------------------------------------------------
